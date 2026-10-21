package clinic;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
class ApiService {
    private static final ZoneId ZONE =
            ZoneId.of("America/Los_Angeles");

    private static final Duration REQUIRED_REST =
            Duration.ofHours(10);

    private final Repository repo;
    private final SchedulingService scheduler;
    private final PasswordEncoder passwords;
        private final AuthSessions sessions;

        ApiService(
                        Repository r,
                        SchedulingService s,
                        PasswordEncoder p,
                        AuthSessions sessions) {
        repo = r;
        scheduler = s;
        passwords = p;
                this.sessions = sessions;
    }

        LoginResponse login(LoginRequest input) {
        if (input == null
                || input.username() == null
                || input.password() == null) {
            throw new ApiException(401, "Invalid username or password");
        }

        User u = repo.user(input.username())
                .orElseThrow(() ->
                        new ApiException(401, "Invalid username or password"));

        if (!u.active()
                || !passwords.matches(
                        input.password(),
                        repo.passwordHash(input.username()))) {
            throw new ApiException(401, "Invalid username or password");
        }

        return new LoginResponse(u, sessions.issue(u.id()));
    }

        void logout(String token) {
                sessions.revoke(token);
        }

    List<User> users(long actor) {
        requireAdmin(actor);
        return repo.users();
    }

    User createUser(long actor, NewUser input) {
        requireAdmin(actor);

        if (input == null
                || input.username() == null
                || input.password() == null
                || input.fullName() == null
                || input.role() == null) {
            throw new ApiException(
                    400,
                    "username, password, fullName, and role are required");
        }

        if (input.role() == Role.ADMIN) {
            throw new ApiException(
                    400,
                    "Only the initial system administrator is supported");
        }

        String username = input.username().trim();
        String fullName = input.fullName().trim();

        if (username.isEmpty() || fullName.isEmpty()) {
            throw new ApiException(
                    400,
                    "Username and full name cannot be blank");
        }

        if (username.length() > 50 || fullName.length() > 120) {
            throw new ApiException(
                    400,
                    "Username or full name is too long");
        }

        if (input.password().length() < 8) {
            throw new ApiException(
                    400,
                    "Password must have at least 8 characters");
        }

        NewUser cleaned = new NewUser(
                username,
                input.password(),
                fullName,
                input.role());

        long id = repo.createUser(
                cleaned,
                passwords.encode(input.password()));

        return repo.user(id).orElseThrow();
    }

    void removeUser(long actor, long target) {
        requireAdmin(actor);

        if (actor == target) {
            throw new ApiException(
                    400,
                    "The administrator cannot remove their own account");
        }

        User targetUser = repo.user(target)
                .orElseThrow(() -> new ApiException(404, "User not found"));

        if (targetUser.role() == Role.ADMIN) {
            throw new ApiException(
                    400,
                    "An administrator account cannot be deactivated here");
        }

        repo.deactivate(target);
    }

    void setPassword(long actor, long target, String password) {
        requireAdmin(actor);

        if (password == null || password.length() < 8) {
            throw new ApiException(
                    400,
                    "Password must have at least 8 characters");
        }

        if (repo.user(target).isEmpty()) {
            throw new ApiException(404, "User not found");
        }

        // An administrator-set password is permanent. Only the password
        // supplied while creating an employee is temporary.
        repo.password(target, passwords.encode(password), false);
    }

    void changeOwnPassword(long user, String password) {
        requireUser(user);

        if (password == null || password.length() < 8) {
            throw new ApiException(
                    400,
                    "Password must have at least 8 characters");
        }

        repo.password(user, passwords.encode(password), false);
    }

    void regenerate(long actor) {
        requireAdmin(actor);
        scheduler.generateTwoWeeks();
    }

    List<Map<String, Object>> schedule(
            long actor,
            long owner,
            LocalDate from,
            LocalDate to) {

        User a = requireUser(actor);

        if (a.id() != owner && a.role() != Role.ADMIN) {
            throw new ApiException(
                    403,
                    "You can only view your own schedule");
        }

        if (from == null) {
            from = LocalDate.now(ZONE);
        }

        if (to == null) {
            to = from.plusDays(13);
        }

        if (to.isBefore(from)) {
            throw new ApiException(
                    400,
                    "The end date must be on or after the start date");
        }

        List<Map<String, Object>> rows = new ArrayList<>();

        for (Shift s : repo.scheduleFor(owner, from, to)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("shift", s);
            row.put(
                    "coworkers",
                    repo.coworkers(s.id()).stream()
                            .filter(u -> u.id() != owner)
                            .toList());

            rows.add(row);
        }

        return rows;
    }

    Map<String, Integer> leaveBalance(
            long actor,
            long owner,
            int year) {

        User a = requireUser(actor);

        if (a.id() != owner && a.role() != Role.ADMIN) {
            throw new ApiException(
                    403,
                    "You can only view your own leave balance");
        }

        if (year == 0) {
            year = LocalDate.now(ZONE).getYear();
        }

        int vacationUsed =
                repo.leaveDays(owner, LeaveType.VACATION, year);

        int sickUsed =
                repo.leaveDays(owner, LeaveType.SICK, year);

        return Map.of(
                "vacationUsed", vacationUsed,
                "vacationRemaining", Math.max(0, 8 - vacationUsed),
                "sickUsed", sickUsed,
                "sickRemaining", Math.max(0, 4 - sickUsed));
    }

    @Transactional
    Decision requestLeave(long actor, TimeOffInput input) {
        User requester = requireUser(actor);

        if (requester.role() != Role.DOCTOR
                && requester.role() != Role.TECHNICIAN) {
            throw new ApiException(
                    403,
                    "Only doctors and technicians can request time off");
        }

        if (input == null
                || input.leaveType() == null
                || input.startDate() == null
                || input.endDate() == null
                || input.endDate().isBefore(input.startDate())) {
            throw new ApiException(
                    400,
                    "A valid leave type, start date, and end date are required");
        }

        LocalDate today = LocalDate.now(ZONE);
        LocalDate start = input.startDate();
        LocalDate end = input.endDate();
        LeaveType type = input.leaveType();

        if (type == LeaveType.VACATION
                && start.isBefore(today.plusWeeks(3))) {
            return deny(
                    actor,
                    input,
                    "request is too late: vacation must be requested at least three weeks in advance");
        }

        if (type == LeaveType.SICK
                && (!start.isAfter(today) || !end.equals(start))) {
            return deny(
                    actor,
                    input,
                    "a sick-day request must be for one day after today");
        }

        if (repo.approvedTimeOffOverlaps(actor, start, end)) {
            return deny(
                    actor,
                    input,
                    "your request cannot be granted because it conflicts with a previous time-off request that was granted");
        }

        int entitlement = type == LeaveType.VACATION ? 8 : 4;

        for (int year = start.getYear(); year <= end.getYear(); year++) {
            LocalDate yearStart = LocalDate.of(year, 1, 1);
            LocalDate yearEnd = LocalDate.of(year, 12, 31);

            LocalDate countedStart =
                    start.isAfter(yearStart) ? start : yearStart;

            LocalDate countedEnd =
                    end.isBefore(yearEnd) ? end : yearEnd;

            int requestedDays = (int) (
                    java.time.temporal.ChronoUnit.DAYS.between(
                            countedStart,
                            countedEnd) + 1);

            if (repo.leaveDays(actor, type, year) + requestedDays
                    > entitlement) {
                return deny(
                        actor,
                        input,
                        type == LeaveType.VACATION
                                ? "you don't have any more vacation time"
                                : "you don't have any more sick days");
            }
        }

        LocalDate firstMonday = start.with(
                TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        LocalDate lastMonday = end.with(
                TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        if (start.equals(firstMonday)) {
            firstMonday = firstMonday.minusWeeks(1);
        }

        long requestId =
                repo.addRequest(actor, input, true, "Request granted");

        try {
            scheduler.generateWeeksAtomically(firstMonday, lastMonday);
        } catch (SchedulingService.ScheduleGenerationException e) {
            repo.deleteRequest(requestId);

            return deny(
                    actor,
                    input,
                    "we will be short on doctors or technicians if we grant your request");
        }

        return new Decision(
                true,
                "request granted; the schedule has been rearranged");
    }

    @Transactional
    Decision requestWorkShift(long actor, WorkShiftInput input) {
        User requester = requireUser(actor);

        if (requester.role() != Role.DOCTOR
                && requester.role() != Role.TECHNICIAN) {
            throw new ApiException(
                    403,
                    "Only doctors and technicians can request work shifts");
        }

        if (input == null
                || input.workDate() == null
                || input.shiftType() == null) {
            throw new ApiException(
                    400,
                    "A work date and shift type are required");
        }

        LocalDate date = input.workDate();
        ShiftType type = input.shiftType();
        LocalDate today = LocalDate.now(ZONE);

        if (!date.isAfter(today)) {
            return denyWorkShift(
                    actor,
                    input,
                    "work-shift requests must be for a future date");
        }

        if (type == ShiftType.SURGERY
                && requester.role() != Role.DOCTOR) {
            return denyWorkShift(
                    actor,
                    input,
                    "only doctors can request a surgery shift");
        }

        LocalDate monday = date.with(
                TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        if (repo.shiftOn(date, type).isEmpty()) {
            try {
                scheduler.generateWeekAtomically(monday);
            } catch (SchedulingService.ScheduleGenerationException e) {
                return denyWorkShift(
                        actor,
                        input,
                        "the schedule cannot be generated for that week because staffing or rest requirements would be violated");
            }
        }

        Shift target = repo.shiftOn(date, type).orElse(null);

        if (target == null) {
            return denyWorkShift(
                    actor,
                    input,
                    "there is no shift of that type on the selected date");
        }

        if (repo.timeOff(actor, date)) {
            return denyWorkShift(
                    actor,
                    input,
                    "your request conflicts with previously granted time off");
        }

        if (repo.approvedWorkRequestConflicts(actor, date, type)) {
            return denyWorkShift(
                    actor,
                    input,
                    "your request cannot be granted because it conflicts with a previous work-shift request that was granted");
        }

        if (repo.approvedWorkRequest(actor, date, type)) {
            return denyWorkShift(
                    actor,
                    input,
                    "you already have an approved request for this shift");
        }

        int required = requester.role() == Role.DOCTOR
                ? target.requiredDoctors()
                : target.requiredTechnicians();

        if (repo.approvedWorkRequestCount(date, type, requester.role())
                >= required) {
            return denyWorkShift(
                    actor,
                    input,
                    "your request cannot be granted because the shift has reached its requested staffing limit");
        }

        long requestId =
                repo.addWorkRequest(actor, input, true, "Request granted");

        try {
            scheduler.generateWeekAtomically(monday);
        } catch (SchedulingService.ScheduleGenerationException e) {
            repo.deleteWorkRequest(requestId);

            return denyWorkShift(
                    actor,
                    input,
                    "the request cannot be granted because staffing coverage or the required 10-hour rest period would be violated");
        }

        return new Decision(
                true,
                "request granted; the schedule has been rearranged");
    }

    @Transactional
    void assignStaff(long actor, long shiftId, long userId) {
        requireAdmin(actor);

        Shift target = repo.shiftById(shiftId)
                .orElseThrow(() -> new ApiException(404, "Shift not found"));

        User employee = repo.user(userId)
                .filter(User::active)
                .orElseThrow(() ->
                        new ApiException(404, "Active employee not found"));

        if (employee.role() != Role.DOCTOR
                && employee.role() != Role.TECHNICIAN) {
            throw new ApiException(
                    400,
                    "Only doctors and technicians can be assigned to shifts");
        }

        if (repo.assignmentExists(shiftId, userId)) {
            throw new ApiException(
                    409,
                    "This employee is already assigned to that shift");
        }

        if (target.shiftType() == ShiftType.SURGERY
                && employee.role() != Role.DOCTOR) {
            throw new ApiException(
                    400,
                    "Only doctors can be assigned to surgery shifts");
        }

        int required = employee.role() == Role.DOCTOR
                ? target.requiredDoctors()
                : target.requiredTechnicians();

        if (repo.assignedCount(shiftId, employee.role()) >= required) {
            throw new ApiException(
                    409,
                    "This shift has reached its staffing limit for that role");
        }

        LocalDate shiftStartDate =
                target.startAt().atZoneSameInstant(ZONE).toLocalDate();

        LocalDate shiftEndDate =
                target.endAt().minusNanos(1)
                        .atZoneSameInstant(ZONE).toLocalDate();

        if (repo.approvedTimeOffOverlaps(
                userId,
                shiftStartDate,
                shiftEndDate)) {
            throw new ApiException(
                    409,
                    "This employee has approved time off during this shift");
        }

        Instant newStart = target.startAt().toInstant();
        Instant newEnd = target.endAt().toInstant();

        List<Shift> existingShifts =
                repo.assignedShiftsForUser(userId);

        for (Shift existing : existingShifts) {
            if (existing.id() == shiftId) {
                continue;
            }

            Instant oldStart = existing.startAt().toInstant();
            Instant oldEnd = existing.endAt().toInstant();

            boolean restConflict =
                    newStart.isBefore(oldEnd.plus(REQUIRED_REST))
                    && oldStart.isBefore(newEnd.plus(REQUIRED_REST));

            if (restConflict) {
                throw new ApiException(
                        409,
                        "Assignment would violate the required 10-hour rest period");
            }

            if (employee.role() == Role.DOCTOR) {
                LocalDate newWeek = shiftStartDate.with(
                        TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

                LocalDate oldDate =
                        existing.startAt()
                                .atZoneSameInstant(ZONE)
                                .toLocalDate();

                LocalDate oldWeek = oldDate.with(
                        TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

                if (newWeek.equals(oldWeek)
                        && target.shiftType() == ShiftType.SURGERY
                        && existing.shiftType() == ShiftType.SURGERY) {
                    throw new ApiException(
                            409,
                            "A doctor cannot have two surgery shifts in the same week");
                }

                if (newWeek.equals(oldWeek)
                        && target.shiftType() == ShiftType.OVERNIGHT
                        && existing.shiftType() == ShiftType.OVERNIGHT) {
                    throw new ApiException(
                            409,
                            "A doctor cannot have two overnight shifts in the same week");
                }
            }
        }

        repo.assign(shiftId, userId);
    }

    @Transactional
    void unassignStaff(long actor, long shiftId, long userId) {
        requireAdmin(actor);

        if (repo.shiftById(shiftId).isEmpty()) {
            throw new ApiException(404, "Shift not found");
        }

        if (repo.user(userId).isEmpty()) {
            throw new ApiException(404, "User not found");
        }

        if (!repo.assignmentExists(shiftId, userId)) {
            throw new ApiException(
                    404,
                    "That employee is not assigned to this shift");
        }

        repo.unassign(shiftId, userId);
    }

    private Decision denyWorkShift(
            long user,
            WorkShiftInput input,
            String reason) {
        repo.addWorkRequest(user, input, false, reason);
        return new Decision(false, reason);
    }

    private Decision deny(
            long user,
            TimeOffInput input,
            String reason) {
        repo.addRequest(user, input, false, reason);
        return new Decision(false, reason);
    }

    @SuppressWarnings("null")
    User requireUser(long id) {
        return repo.user(id)
                .filter(User::active)
                .orElseThrow(() -> new ApiException(401, "Invalid user"));
    }

    void requireAdmin(long id) {
        if (requireUser(id).role() != Role.ADMIN) {
            throw new ApiException(
                    403,
                    "Administrator access is required");
        }
    }
}
