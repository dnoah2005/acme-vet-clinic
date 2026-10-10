package clinic;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
class SchedulingService {
    private static final ZoneId CLINIC_ZONE = ZoneId.of("America/Los_Angeles");
    private final Repository repo;

    SchedulingService(Repository repo) {
        this.repo = repo;
    }

    @Transactional
    void generateTwoWeeks() {
        LocalDate monday = LocalDate.now(CLINIC_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        if (!generateWeek(monday) || !generateWeek(monday.plusWeeks(1)))
            throw new ApiException(409, "There are not enough available staff members to build a complete schedule");
    }
  
    boolean generateWeek(LocalDate monday) {
        List<Template> templates = templates(monday);
        repo.deleteWeek(monday);
        List<Shift> shifts = new ArrayList<>();
        for (Template t : templates)
            shifts.add(new Shift(
                repo.addShift(
                    t.start, 
                    t.end, 
                    t.type, 
                    t.doctors, 
                    t.technicians
                ), 
                t.start, 
                t.end,
                t.type, 
                t.doctors, 
                t.technicians
            ));
        Map<Long, List<Shift>> work = new HashMap<>();
        if (!assignRole(shifts, repo.staff(Role.DOCTOR), Role.DOCTOR, work))
            return false;
        if (!assignRole(shifts, repo.staff(Role.TECHNICIAN), Role.TECHNICIAN, work))
            return false;
        return true;
    }

    private boolean assignRole(List<Shift> shifts, List<User> people, Role role, Map<Long, List<Shift>> work) {
        if (people.isEmpty())
            return false;
        Set<Long> surgeryThisWeek = new HashSet<>();
        Set<Long> overnightThisWeek = new HashSet<>();
        Map<Long, Integer> loads = new HashMap<>();
        for (User p : people)
            if (p != null)
                loads.put(p.id(), 0);
        for (Shift shift : shifts) {
            int needed = role == Role.DOCTOR ? shift.requiredDoctors() : shift.requiredTechnicians();
            for (int slot = 0; slot < needed; slot++) {
                User candidate = people.stream()
                        .filter(p -> p != null && p.active())
                        .filter(p -> !repo.timeOff(p.id(),
                                shift.startAt().atZoneSameInstant(CLINIC_ZONE).toLocalDate()))
                        .filter(p -> !conflicts(work.getOrDefault(p.id(), List.of()), shift))
                        .filter(p -> role != Role.DOCTOR || shift.shiftType() != ShiftType.SURGERY
                                || !surgeryThisWeek.contains(p.id()))
                        .filter(p -> role != Role.DOCTOR || shift.shiftType() != ShiftType.OVERNIGHT
                                || !overnightThisWeek.contains(p.id()))
                        .filter(user -> user != null && user.active())
                        .min(Comparator.comparingInt((User p) -> loads.get(p.id())).thenComparingLong(User::id))
                        .orElse(null);
                if (candidate == null)
                    return false;
                repo.assign(shift.id(), candidate.id());
                work.computeIfAbsent(candidate.id(), x -> new ArrayList<>()).add(shift);
                loads.merge(candidate.id(), 1, Integer::sum);
                if (role == Role.DOCTOR && shift.shiftType() == ShiftType.SURGERY)
                    surgeryThisWeek.add(candidate.id());
                if (role == Role.DOCTOR && shift.shiftType() == ShiftType.OVERNIGHT)
                    overnightThisWeek.add(candidate.id());
            }
        }
        return true;
    }

    private boolean conflicts(List<Shift> assigned, Shift proposed) {
        for (Shift old : assigned) {
            // A 10-hour break is required from one shift's end until the next starts.
            if (old.endAt().plusHours(10).isAfter(proposed.startAt())
                    && proposed.endAt().plusHours(10).isAfter(old.startAt()))
                return true;
        }
        return false;
    }

    private List<Template> templates(LocalDate monday) {
        List<Template> result = new ArrayList<>();
        for (int offset = 0; offset < 6; offset++) {
            LocalDate day = monday.plusDays(offset);
            result.add(t(day, LocalTime.of(7, 30), LocalTime.of(18, 30), ShiftType.EARLY, 1));
            result.add(t(day, LocalTime.of(7, 30), LocalTime.of(18, 30), ShiftType.SURGERY, 1));
            result.add(t(day, LocalTime.of(8, 30), LocalTime.of(19, 30), ShiftType.EIGHT_THIRTY, 1));
            result.add(t(day, LocalTime.of(9, 30), LocalTime.of(20, 30), ShiftType.LATE, 1));
            result.add(t(day, LocalTime.of(20, 0), LocalTime.of(8, 0), ShiftType.OVERNIGHT, 1));
        }
        LocalDate sun = monday.plusDays(6);
        result.add(t(sun, LocalTime.of(8, 0), LocalTime.of(20, 0), ShiftType.SUNDAY, 1));
        result.add(t(sun, LocalTime.of(20, 0), LocalTime.of(8, 0), ShiftType.OVERNIGHT, 1));
        // The eight extra doctor positions: Saturday Early, Friday Late, then six Early
        // shifts.
        result.get(indexOf(result, 5, ShiftType.EARLY)).doctors++;
        result.get(indexOf(result, 4, ShiftType.LATE)).doctors++;
        for (int day = 0; day < 6; day++)
            result.get(indexOf(result, day, ShiftType.EARLY)).doctors++;
        int minimum = 0;
        for (Template x : result) {
            x.technicians = (x.type == ShiftType.OVERNIGHT) ? 1 : (x.type == ShiftType.SUNDAY ? 2 : x.doctors);
            minimum += x.technicians;
        }
        int extras = Math.max(0, 80 - minimum); // 20 technicians x four weekly shifts
        List<Template> regular = result.stream()
                .filter(x -> x.type != ShiftType.OVERNIGHT && x.type != ShiftType.SUNDAY).toList();
        for (int i = 0; i < extras; i++)
            regular.get(i % regular.size()).technicians++;
        return result;
    }

    private int indexOf(List<Template> templates, int day, ShiftType type) {
        for (int i = 0; i < templates.size(); i++)
            if (templates.get(i).start.toLocalDate().getDayOfWeek().getValue() == day + 1
                    && templates.get(i).type == type)
                return i;
        throw new IllegalStateException();
    }

    private Template t(LocalDate day, LocalTime start, LocalTime end, ShiftType type, int doctors) {
        OffsetDateTime s = ZonedDateTime.of(day, start, CLINIC_ZONE).toOffsetDateTime();
        if (!end.isAfter(start))
            day = day.plusDays(1);
        return new Template(s, ZonedDateTime.of(day, end, CLINIC_ZONE).toOffsetDateTime(), type, doctors, 0);
    }

    private static class Template {
        final OffsetDateTime start, end;
        final ShiftType type;
        int doctors, technicians;

        Template(OffsetDateTime s, OffsetDateTime e, ShiftType t, int d, int tech) {
            start = s;
            end = e;
            type = t;
            doctors = d;
            technicians = tech;
        }
    }
}
