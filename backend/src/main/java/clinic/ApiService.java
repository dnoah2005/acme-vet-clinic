package clinic;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
class ApiService {
    private static final ZoneId ZONE = ZoneId.of("America/Los_Angeles");
    private final Repository repo;
    private final SchedulingService scheduler;
    private final PasswordEncoder passwords;

    ApiService(Repository r, SchedulingService s, PasswordEncoder p) {
        repo = r;
        scheduler = s;
        passwords = p;
    }

    User login(LoginRequest input) {
        User u = repo.user(input.username()).orElseThrow(() -> new ApiException(401, "Invalid username or password"));
        if (!u.active() || !passwords.matches(input.password(), repo.passwordHash(input.username())))
            throw new ApiException(401, "Invalid username or password");
        return u;
    }

    List<User> users(long actor) {
        requireAdmin(actor);
        return repo.users();
    }

    User createUser(long actor, NewUser input) {
        requireAdmin(actor);
        if (input.role() == Role.ADMIN)
            throw new ApiException(400, "Only the initial system administrator is supported");
        if (input.username() == null || input.password() == null || input.fullName() == null)
            throw new ApiException(400, "username, password, fullName, and role are required");
        long id = repo.createUser(input, passwords.encode(input.password()));
        return repo.user(id).orElseThrow();
    }

    void removeUser(long actor, long target) {
        requireAdmin(actor);
        if (actor == target)
            throw new ApiException(400, "The administrator cannot remove their own account");
        repo.deactivate(target);
    }

    void setPassword(long actor, long target, String password) {
        requireAdmin(actor);
        if (password == null || password.length() < 8)
            throw new ApiException(400, "Password must have at least 8 characters");
        repo.password(target, passwords.encode(password), true);
    }

    void changeOwnPassword(long user, String password) {
        if (password == null || password.length() < 8)
            throw new ApiException(400, "Password must have at least 8 characters");
        repo.password(user, passwords.encode(password), false);
    }

    void regenerate(long actor) {
        requireAdmin(actor);
        scheduler.generateTwoWeeks();
    }

    List<Map<String, Object>> schedule(long actor, long owner, LocalDate from, LocalDate to) {
        User a = requireUser(actor);
        if (a.id() != owner && a.role() != Role.ADMIN)
            throw new ApiException(403, "You can only view your own schedule");
        if (from == null)
            from = LocalDate.now(ZONE);
        if (to == null)
            to = from.plusDays(13);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Shift s : repo.scheduleFor(owner, from, to)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("shift", s);
            row.put("coworkers", repo.coworkers(s.id()).stream().filter(u -> u.id() != owner).toList());
            rows.add(row);
        }
        return rows;
    }

    Map<String, Integer> leaveBalance(long actor, long owner, int year) {
        User a = requireUser(actor);
        if (a.id() != owner && a.role() != Role.ADMIN)
            throw new ApiException(403, "You can only view your own leave balance");
        if (year == 0)
            year = LocalDate.now(ZONE).getYear();
        return Map.of("vacationRemaining", 8 - repo.leaveDays(owner, LeaveType.VACATION, year), "sickRemaining",
                4 - repo.leaveDays(owner, LeaveType.SICK, year));
    }

    @Transactional
    Decision requestLeave(long actor, TimeOffInput input) {
        requireUser(actor);
        if (input == null || input.leaveType() == null || input.startDate() == null || input.endDate() == null || input.endDate().isBefore(input.startDate()))
            throw new ApiException(400, "A valid leave type, start date, and end date are required");
        LocalDate today = LocalDate.now(ZONE);
        if (input.leaveType() == LeaveType.VACATION && input.startDate().isBefore(today.plusWeeks(3)))
            return deny(actor, input, "request is too late");
        if (input.leaveType() == LeaveType.SICK && !input.startDate().isAfter(today))
            return deny(actor, input, "request is too late");
        int entitlement = input.leaveType() == LeaveType.VACATION ? 8 : 4;
        for (int year = input.startDate().getYear(); year <= input.endDate().getYear(); year++) {
            LocalDate lo = LocalDate.of(year, 1, 1);
            LocalDate hi = LocalDate.of(year, 12, 31);
            int requested = (int) (java.time.temporal.ChronoUnit.DAYS.between(
                    input.startDate().isAfter(lo) ? input.startDate() : lo,
                    input.endDate().isBefore(hi) ? input.endDate() : hi) + 1);
            if (repo.leaveDays(actor, input.leaveType(), year) + requested > entitlement)
                return deny(actor, input,
                        input.leaveType() == LeaveType.VACATION ? "you don't have any more vacation time"
                                : "you don't have any more sick days");
        }
        long request = repo.addRequest(actor, input, true, null);
        boolean ok = true;
        for (LocalDate monday = input.startDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); !monday.isAfter(input.endDate()); monday = monday.plusWeeks(1))
            ok &= scheduler.generateWeek(monday);
        if (!ok) {
            repo.deleteRequest(request);
            for (LocalDate monday = input.startDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); !monday.isAfter(input.endDate()); monday = monday.plusWeeks(1))
                scheduler.generateWeek(monday);
            return deny(actor, input, "we will be short on doctors or technicians if we grant your request");
        }
        return new Decision(true, "request granted");
    }

    private Decision deny(long user, TimeOffInput input, String reason) {
        repo.addRequest(user, input, false, reason);
        return new Decision(false, reason);
    }

    @SuppressWarnings("null")
    User requireUser(long id) {
        return repo.user(id).filter(User::active).orElseThrow(() -> new ApiException(401, "Invalid user"));
    }

    void requireAdmin(long id) {
        if (requireUser(id).role() != Role.ADMIN)
            throw new ApiException(403, "Administrator access is required");
    }
}
