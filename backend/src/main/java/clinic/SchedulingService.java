package clinic;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
class SchedulingService {
    private static final ZoneId CLINIC_ZONE =
            ZoneId.of("America/Los_Angeles");

    private final Repository repo;

    SchedulingService(Repository repo) {
        this.repo = repo;
    }

    @Transactional
    void generateTwoWeeks() {
        LocalDate monday = LocalDate.now(CLINIC_ZONE)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        if (!generateWeekInternal(monday)
                || !generateWeekInternal(monday.plusWeeks(1))) {
            throw new ApiException(
                    409,
                    "There are not enough available staff members to build a complete schedule"
            );
        }
    }

    /**
     * Generates all requested weeks as one nested transaction.
     * If any week cannot be generated, throwing an exception rolls back
     * every schedule change made during this operation.
     */
    @Transactional(propagation = Propagation.NESTED)
    public void generateWeeksAtomically(
            LocalDate firstMonday,
            LocalDate lastMonday) {

        for (LocalDate monday = firstMonday;
                !monday.isAfter(lastMonday);
                monday = monday.plusWeeks(1)) {

            if (!generateWeekInternal(monday)) {
                throw new ScheduleGenerationException(
                        "Could not generate the schedule for week starting "
                                + monday
                );
            }
        }
    }

    /**
     * Generates one week in a nested transaction.
     * A failed generation rolls back instead of leaving partial shifts.
     */
    @Transactional(propagation = Propagation.NESTED)
    public void generateWeekAtomically(LocalDate monday) {
        if (!generateWeekInternal(monday)) {
            throw new ScheduleGenerationException(
                    "Could not generate the schedule for week starting "
                            + monday
            );
        }
    }

    /**
     * Retained for compatibility with existing code.
     * New request-handling code should use generateWeekAtomically().
     */
    boolean generateWeek(LocalDate monday) {
        return generateWeekInternal(monday);
    }

    private boolean generateWeekInternal(LocalDate monday) {
        List<Template> templates = templates(monday);

        repo.deleteWeek(monday);

        List<Shift> shifts = new ArrayList<>();

        for (Template t : templates) {
            long id = repo.addShift(
                    t.start,
                    t.end,
                    t.type,
                    t.doctors,
                    t.technicians
            );

            shifts.add(new Shift(
                    id,
                    t.start,
                    t.end,
                    t.type,
                    t.doctors,
                    t.technicians
            ));
        }

        Map<Long, List<Shift>> work = new HashMap<>();

        if (!assignRole(
                shifts,
                repo.staff(Role.DOCTOR),
                Role.DOCTOR,
                work)) {
            return false;
        }

        if (!assignRole(
                shifts,
                repo.staff(Role.TECHNICIAN),
                Role.TECHNICIAN,
                work)) {
            return false;
        }

        return true;
    }

    private boolean assignRole(
            List<Shift> shifts,
            List<User> people,
            Role role,
            Map<Long, List<Shift>> work) {

        if (people.isEmpty()) {
            return false;
        }

        Set<Long> surgeryThisWeek = new HashSet<>();
        Set<Long> overnightThisWeek = new HashSet<>();

        Map<Long, Integer> loads = new HashMap<>();

        for (User p : people) {
            if (p != null && p.active()) {
                loads.put(p.id(), 0);
            }
        }

        Map<Long, Integer> assignedCounts = new HashMap<>();
        LocalDate weekStart = shifts.getFirst().startAt()
            .atZoneSameInstant(CLINIC_ZONE)
            .toLocalDate();

        for (User person : people) {
            for (Shift existing : repo.assignedShiftsForUser(person.id())) {
            LocalDate existingWeek = existing.startAt()
                .atZoneSameInstant(CLINIC_ZONE)
                .toLocalDate()
                .with(TemporalAdjusters.previousOrSame(
                    DayOfWeek.MONDAY));

            if (!existingWeek.equals(weekStart)) {
                work.computeIfAbsent(
                    person.id(),
                    x -> new ArrayList<>())
                    .add(existing);
            }
            }
        }

        for (ApprovedWorkShiftRequest request :
            repo.approvedWorkRequests(
                weekStart,
                weekStart.plusDays(6),
                role)) {

            Shift shift = shifts.stream()
                .filter(s -> s.shiftType() == request.shiftType())
                .filter(s -> s.startAt()
                    .atZoneSameInstant(CLINIC_ZONE)
                    .toLocalDate()
                    .equals(request.workDate()))
                .findFirst()
                .orElse(null);

            User candidate = people.stream()
                .filter(p -> p != null
                    && p.id() == request.userId()
                    && p.active())
                .findFirst()
                .orElse(null);

            if (shift == null || candidate == null
                || assignedCounts.getOrDefault(shift.id(), 0)
                    >= requiredStaff(shift, role)
                || !eligible(
                    candidate,
                    shift,
                    role,
                    work,
                    surgeryThisWeek,
                    overnightThisWeek)) {
            return false;
            }

            repo.assign(shift.id(), candidate.id());
            work.computeIfAbsent(
                candidate.id(),
                x -> new ArrayList<>()).add(shift);
            loads.merge(candidate.id(), 1, Integer::sum);
            assignedCounts.merge(shift.id(), 1, Integer::sum);
            recordWeeklyShift(
                candidate,
                shift,
                role,
                surgeryThisWeek,
                overnightThisWeek);
        }

        for (Shift shift : shifts) {
            int needed = requiredStaff(shift, role)
                - assignedCounts.getOrDefault(shift.id(), 0);

            for (int slot = 0; slot < needed; slot++) {
                User candidate = people.stream()
                        .filter(p -> p != null && p.active())
                        .filter(p -> loads.containsKey(p.id()))
                .filter(p -> eligible(
                    p,
                    shift,
                    role,
                    work,
                    surgeryThisWeek,
                    overnightThisWeek))
                        .min(
                                Comparator.comparingInt(
                                        (User p) -> loads.get(p.id())
                                ).thenComparingLong(User::id)
                        )
                        .orElse(null);

                if (candidate == null) {
                    return false;
                }

                repo.assign(shift.id(), candidate.id());

                work.computeIfAbsent(
                        candidate.id(),
                        x -> new ArrayList<>()
                ).add(shift);

                loads.merge(candidate.id(), 1, Integer::sum);
                assignedCounts.merge(shift.id(), 1, Integer::sum);
                recordWeeklyShift(
                        candidate,
                        shift,
                        role,
                        surgeryThisWeek,
                        overnightThisWeek);
            }
        }

        return true;
    }

    private boolean eligible(
            User candidate,
            Shift shift,
            Role role,
            Map<Long, List<Shift>> work,
            Set<Long> surgeryThisWeek,
            Set<Long> overnightThisWeek) {

        LocalDate shiftStart = shift.startAt()
            .atZoneSameInstant(CLINIC_ZONE)
            .toLocalDate();
        LocalDate shiftEnd = shift.endAt()
            .minusNanos(1)
            .atZoneSameInstant(CLINIC_ZONE)
            .toLocalDate();

        return !repo.approvedTimeOffOverlaps(
                candidate.id(),
                shiftStart,
                shiftEnd)
                && !conflicts(
                        work.getOrDefault(candidate.id(), List.of()),
                        shift)
                && (role != Role.DOCTOR
                        || shift.shiftType() != ShiftType.SURGERY
                        || !surgeryThisWeek.contains(candidate.id()))
                && (role != Role.DOCTOR
                        || shift.shiftType() != ShiftType.OVERNIGHT
                        || !overnightThisWeek.contains(candidate.id()));
    }

    private int requiredStaff(Shift shift, Role role) {
        return role == Role.DOCTOR
                ? shift.requiredDoctors()
                : shift.requiredTechnicians();
    }

    private void recordWeeklyShift(
            User candidate,
            Shift shift,
            Role role,
            Set<Long> surgeryThisWeek,
            Set<Long> overnightThisWeek) {

        if (role == Role.DOCTOR
                && shift.shiftType() == ShiftType.SURGERY) {
            surgeryThisWeek.add(candidate.id());
        }

        if (role == Role.DOCTOR
                && shift.shiftType() == ShiftType.OVERNIGHT) {
            overnightThisWeek.add(candidate.id());
        }
    }

    private boolean conflicts(List<Shift> assigned, Shift proposed) {
        for (Shift old : assigned) {
            // A 10-hour break is required between shifts.
            if (old.endAt().plusHours(10).isAfter(proposed.startAt())
                    && proposed.endAt().plusHours(10)
                            .isAfter(old.startAt())) {
                return true;
            }
        }

        return false;
    }

    private List<Template> templates(LocalDate monday) {
        List<Template> result = new ArrayList<>();

        for (int offset = 0; offset < 6; offset++) {
            LocalDate day = monday.plusDays(offset);

            result.add(t(
                    day,
                    LocalTime.of(7, 30),
                    LocalTime.of(18, 30),
                    ShiftType.EARLY,
                    1
            ));

            result.add(t(
                    day,
                    LocalTime.of(7, 30),
                    LocalTime.of(18, 30),
                    ShiftType.SURGERY,
                    1
            ));

            result.add(t(
                    day,
                    LocalTime.of(8, 30),
                    LocalTime.of(19, 30),
                    ShiftType.EIGHT_THIRTY,
                    1
            ));

            result.add(t(
                    day,
                    LocalTime.of(9, 30),
                    LocalTime.of(20, 30),
                    ShiftType.LATE,
                    1
            ));

            result.add(t(
                    day,
                    LocalTime.of(20, 0),
                    LocalTime.of(8, 0),
                    ShiftType.OVERNIGHT,
                    1
            ));
        }

        LocalDate sunday = monday.plusDays(6);

        result.add(t(
                sunday,
                LocalTime.of(8, 0),
                LocalTime.of(20, 0),
                ShiftType.SUNDAY,
                1
        ));

        result.add(t(
                sunday,
                LocalTime.of(20, 0),
                LocalTime.of(8, 0),
                ShiftType.OVERNIGHT,
                1
        ));

        // The eight extra doctor positions: Saturday Early, Friday Late,
        // and one additional doctor on each weekday Early shift.
        result.get(indexOf(result, 5, ShiftType.EARLY)).doctors++;
        result.get(indexOf(result, 4, ShiftType.LATE)).doctors++;

        for (int day = 0; day < 6; day++) {
            result.get(indexOf(result, day, ShiftType.EARLY)).doctors++;
        }

        int minimum = 0;

        for (Template template : result) {
            template.technicians =
                    template.type == ShiftType.OVERNIGHT
                            ? 1
                            : template.type == ShiftType.SUNDAY
                                    ? 2
                                    : template.doctors;

            minimum += template.technicians;
        }

        int extras = Math.max(0, 80 - minimum);

        List<Template> regular = result.stream()
                .filter(x -> x.type != ShiftType.OVERNIGHT
                        && x.type != ShiftType.SUNDAY)
                .toList();

        for (int i = 0; i < extras; i++) {
            regular.get(i % regular.size()).technicians++;
        }

        return result;
    }

    private int indexOf(
            List<Template> templates,
            int day,
            ShiftType type) {

        for (int i = 0; i < templates.size(); i++) {
            if (templates.get(i).start.toLocalDate()
                            .getDayOfWeek().getValue() == day + 1
                    && templates.get(i).type == type) {
                return i;
            }
        }

        throw new IllegalStateException(
                "Could not find " + type + " template for weekday " + day
        );
    }

    private Template t(
            LocalDate day,
            LocalTime start,
            LocalTime end,
            ShiftType type,
            int doctors) {

        OffsetDateTime startAt = ZonedDateTime
                .of(day, start, CLINIC_ZONE)
                .toOffsetDateTime();

        LocalDate endDay = !end.isAfter(start)
                ? day.plusDays(1)
                : day;

        OffsetDateTime endAt = ZonedDateTime
                .of(endDay, end, CLINIC_ZONE)
                .toOffsetDateTime();

        return new Template(
                startAt,
                endAt,
                type,
                doctors,
                0
        );
    }

    static class ScheduleGenerationException extends RuntimeException {
        ScheduleGenerationException(String message) {
            super(message);
        }
    }

    private static class Template {
        final OffsetDateTime start;
        final OffsetDateTime end;
        final ShiftType type;
        int doctors;
        int technicians;

        Template(
                OffsetDateTime start,
                OffsetDateTime end,
                ShiftType type,
                int doctors,
                int technicians) {

            this.start = start;
            this.end = end;
            this.type = type;
            this.doctors = doctors;
            this.technicians = technicians;
        }
    }
}