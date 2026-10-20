package clinic;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SchedulingServiceTest {
    @Test
    void approvedWorkShiftRequestIsAssignedDuringRegeneration() {
        LocalDate monday = LocalDate.of(2026, 10, 19);
        User requester = new User(
                1,
                "doctor1",
                "Doctor 1",
                Role.DOCTOR,
                true,
                false);
        List<User> doctors = java.util.stream.IntStream.range(0, 10)
                .mapToObj(i -> i == 0
                        ? requester
                        : new User(
                                i + 1,
                                "doctor" + (i + 1),
                                "Doctor " + (i + 1),
                                Role.DOCTOR,
                                true,
                                false))
                .toList();
        List<User> technicians = java.util.stream.IntStream.range(0, 20)
                .mapToObj(i -> new User(
                        i + 101,
                        "tech" + (i + 1),
                        "Technician " + (i + 1),
                        Role.TECHNICIAN,
                        true,
                        false))
                .toList();
        InMemoryRepository repo = new InMemoryRepository(
                doctors,
                technicians,
                List.of(new ApprovedWorkShiftRequest(
                        requester.id(),
                        monday,
                ShiftType.SURGERY)),
            Map.of());
        SchedulingService scheduler = new SchedulingService(repo);

        assertTrue(scheduler.generateWeek(monday));
        assertTrue(repo.assignments.contains(new Assignment(2, requester.id())));
    }

        @Test
        void mondayLeaveExcludesPreviousSundayOvernight() {
        LocalDate monday = LocalDate.of(2026, 10, 19);
        User requester = new User(
            1,
            "doctor1",
            "Doctor 1",
            Role.DOCTOR,
            true,
            false);
        List<User> doctors = java.util.stream.IntStream.range(0, 10)
            .mapToObj(i -> i == 0
                ? requester
                : new User(
                    i + 1,
                    "doctor" + (i + 1),
                    "Doctor " + (i + 1),
                    Role.DOCTOR,
                    true,
                    false))
            .toList();
        List<User> technicians = java.util.stream.IntStream.range(0, 20)
            .mapToObj(i -> new User(
                i + 101,
                "tech" + (i + 1),
                "Technician " + (i + 1),
                Role.TECHNICIAN,
                true,
                false))
            .toList();
        InMemoryRepository repo = new InMemoryRepository(
            doctors,
            technicians,
            List.of(),
            Map.of(requester.id(), Set.of(monday)));
        SchedulingService scheduler = new SchedulingService(repo);

        assertTrue(
            scheduler.generateWeek(monday.minusWeeks(1)),
            "Could not generate with a single Monday leave; assignments: "
                + repo.assignments.size());
        assertTrue(repo.assignments.stream()
            .anyMatch(assignment -> assignment.shiftId() == 32));
        assertTrue(!repo.assignments.contains(new Assignment(32, requester.id())));
        }

        @Test
        void adjacentWeekOvernightCountsTowardTenHourRest() {
        LocalDate monday = LocalDate.of(2026, 10, 19);
        User requester = new User(
            1,
            "doctor1",
            "Doctor 1",
            Role.DOCTOR,
            true,
            false);
        List<User> doctors = java.util.stream.IntStream.range(0, 10)
            .mapToObj(i -> i == 0
                ? requester
                : new User(
                    i + 1,
                    "doctor" + (i + 1),
                    "Doctor " + (i + 1),
                    Role.DOCTOR,
                    true,
                    false))
            .toList();
        List<User> technicians = java.util.stream.IntStream.range(0, 20)
            .mapToObj(i -> new User(
                i + 101,
                "tech" + (i + 1),
                "Technician " + (i + 1),
                Role.TECHNICIAN,
                true,
                false))
            .toList();
        Shift previousSundayOvernight = new Shift(
            1000,
            monday.minusDays(1).atTime(20, 0)
                .atZone(java.time.ZoneId.of("America/Los_Angeles"))
                .toOffsetDateTime(),
            monday.atTime(8, 0)
                .atZone(java.time.ZoneId.of("America/Los_Angeles"))
                .toOffsetDateTime(),
            ShiftType.OVERNIGHT,
            1,
            1);
        InMemoryRepository repo = new InMemoryRepository(
            doctors,
            technicians,
            List.of(),
            Map.of(),
            Map.of(requester.id(), List.of(previousSundayOvernight)));
        SchedulingService scheduler = new SchedulingService(repo);

        assertTrue(scheduler.generateWeek(monday));
        assertTrue(!repo.assignments.contains(new Assignment(1, requester.id())));
        }

    private static class InMemoryRepository extends Repository {
        private final List<User> doctors;
        private final List<User> technicians;
        private final List<ApprovedWorkShiftRequest> requests;
        private final Map<Long, Set<LocalDate>> timeOff;
        private final Map<Long, List<Shift>> previousAssignments;
        private final Map<Long, Shift> shifts = new HashMap<>();
        private final List<Assignment> assignments = new ArrayList<>();
        private long nextShiftId;

        InMemoryRepository(
                List<User> doctors,
                List<User> technicians,
                List<ApprovedWorkShiftRequest> requests,
                Map<Long, Set<LocalDate>> timeOff) {
            this(doctors, technicians, requests, timeOff, Map.of());
        }

        InMemoryRepository(
                List<User> doctors,
                List<User> technicians,
                List<ApprovedWorkShiftRequest> requests,
                Map<Long, Set<LocalDate>> timeOff,
                Map<Long, List<Shift>> previousAssignments) {
            super(null);
            this.doctors = doctors;
            this.technicians = technicians;
            this.requests = requests;
            this.timeOff = timeOff;
            this.previousAssignments = previousAssignments;
        }

        @Override
        List<User> staff(Role role) {
            return role == Role.DOCTOR ? doctors : technicians;
        }

        @Override
        List<ApprovedWorkShiftRequest> approvedWorkRequests(
                LocalDate start,
                LocalDate end,
                Role role) {
            if (role != Role.DOCTOR) {
                return List.of();
            }

            return requests.stream()
                    .filter(request -> !request.workDate().isBefore(start)
                            && !request.workDate().isAfter(end))
                    .toList();
        }

        @Override
        void deleteWeek(LocalDate monday) {
            shifts.clear();
            assignments.clear();
        }

        @Override
        long addShift(
                OffsetDateTime start,
                OffsetDateTime end,
                ShiftType type,
                int doctors,
                int technicians) {
            long id = ++nextShiftId;
            shifts.put(id, new Shift(
                    id,
                    start,
                    end,
                    type,
                    doctors,
                    technicians));
            return id;
        }

        @Override
        void assign(long shiftId, long userId) {
            assignments.add(new Assignment(shiftId, userId));
        }

        @Override
        List<Shift> assignedShiftsForUser(long userId) {
            List<Shift> assigned = new ArrayList<>(
                previousAssignments.getOrDefault(userId, List.of()));
            assignments.stream()
                .filter(assignment -> assignment.userId() == userId)
                .map(assignment -> shifts.get(assignment.shiftId()))
                .filter(java.util.Objects::nonNull)
                .forEach(assigned::add);
            return assigned;
        }

        @Override
        boolean approvedTimeOffOverlaps(
            long userId,
            LocalDate start,
            LocalDate end) {
            return timeOff.getOrDefault(userId, Set.of()).stream()
                .anyMatch(date -> !date.isBefore(start)
                    && !date.isAfter(end));
        }
    }
}
