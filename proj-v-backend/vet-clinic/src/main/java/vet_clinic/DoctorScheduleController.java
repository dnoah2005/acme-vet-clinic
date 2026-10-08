package vet_clinic;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
public class DoctorScheduleController {

    private final DoctorScheduleRepository scheduleRepository;
    private final DoctorRepository doctorRepository;
    private final LoginRepository loginRepository;

    public DoctorScheduleController(
            DoctorScheduleRepository scheduleRepository,
            DoctorRepository doctorRepository,
            LoginRepository loginRepository
    ) {
        this.scheduleRepository = scheduleRepository;
        this.doctorRepository = doctorRepository;
        this.loginRepository = loginRepository;
    }

    @GetMapping("/schedules")
    public List<DoctorScheduleResponse> getSchedules(
            @RequestParam LocalDate start,
            @RequestParam LocalDate end
    ) {
        return scheduleRepository
                .findByShiftDateBetween(start, end.minusDays(1))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @PostMapping("/doctors/{doctorId}/schedules")
    public ResponseEntity<?> registerSchedule(
            @PathVariable Integer doctorId,
            @RequestBody DoctorScheduleRequest request
    ) {

        Optional<Doctor> doctorOptional =
                doctorRepository.findById(doctorId);

        if (doctorOptional.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body("Doctor does not exist.");
        }

        Doctor doctor = doctorOptional.get();

        Optional<Login> loginOptional =
                loginRepository.findById(doctor.getLid());

        if (loginOptional.isEmpty()
                || !"doctor".equals(loginOptional.get().getRole())) {

            return ResponseEntity.badRequest()
                    .body("This account is not a doctor.");
        }

        LocalDate shiftDate = request.shiftDate();
        String shiftType = request.shiftType();

        if (shiftDate == null || shiftType == null) {
            return ResponseEntity.badRequest()
                    .body("Date and shift are required.");
        }

        LocalDate earliestDate =
                LocalDate.now().plusDays(14);

        if (shiftDate.isBefore(earliestDate)) {
            return ResponseEntity.badRequest()
                    .body(
                        "Schedules must be registered at least 2 weeks ahead."
                    );
        }

        if (!isValidShiftForDay(shiftDate, shiftType)) {
            return ResponseEntity.badRequest()
                    .body("That shift is not available on that day.");
        }

        if (scheduleRepository
                .existsByDoctor_DoctorIdAndShiftDateAndShiftType(
                        doctorId,
                        shiftDate,
                        shiftType
                )) {

            return ResponseEntity.badRequest()
                    .body("You are already registered for this shift.");
        }

        LocalDate weekStart =
                shiftDate.with(DayOfWeek.MONDAY);

        LocalDate weekEnd =
                weekStart.plusDays(6);

        long weeklyShifts =
                scheduleRepository
                        .countByDoctor_DoctorIdAndShiftDateBetween(
                                doctorId,
                                weekStart,
                                weekEnd
                        );

        if (weeklyShifts >= 4) {
            return ResponseEntity.badRequest()
                    .body("You cannot work more than 4 shifts in one week.");
        }

        if ("SURGERY".equals(shiftType)) {

            long surgeryCount =
                    scheduleRepository
                            .countByDoctor_DoctorIdAndShiftDateBetweenAndShiftType(
                                    doctorId,
                                    weekStart,
                                    weekEnd,
                                    "SURGERY"
                            );

            if (surgeryCount >= 1) {
                return ResponseEntity.badRequest()
                        .body(
                            "You cannot have two surgery days in the same week."
                        );
            }
        }

        if ("OVERNIGHT".equals(shiftType)) {

            long overnightCount =
                    scheduleRepository
                            .countByDoctor_DoctorIdAndShiftDateBetweenAndShiftType(
                                    doctorId,
                                    weekStart,
                                    weekEnd,
                                    "OVERNIGHT"
                            );

            if (overnightCount >= 1) {
                return ResponseEntity.badRequest()
                        .body(
                            "You cannot have two overnight shifts in the same week."
                        );
            }
        }

        int capacity =
                getShiftCapacity(shiftDate, shiftType);

        long currentCount =
                scheduleRepository
                        .countByShiftDateAndShiftType(
                                shiftDate,
                                shiftType
                        );

        if (currentCount >= capacity) {
            return ResponseEntity.badRequest()
                    .body("That shift is already full.");
        }

        LocalDate nearbyStart =
                weekStart.minusDays(1);

        LocalDate nearbyEnd =
                weekEnd.plusDays(1);

        List<DoctorSchedule> nearbySchedules =
                scheduleRepository
                        .findByDoctor_DoctorIdAndShiftDateBetween(
                                doctorId,
                                nearbyStart,
                                nearbyEnd
                        );

        LocalDateTime newStart =
                getStartTime(shiftDate, shiftType);

        LocalDateTime newEnd =
                getEndTime(shiftDate, shiftType);

        for (DoctorSchedule existing : nearbySchedules) {

            LocalDateTime existingStart =
                    getStartTime(
                            existing.getShiftDate(),
                            existing.getShiftType()
                    );

            LocalDateTime existingEnd =
                    getEndTime(
                            existing.getShiftDate(),
                            existing.getShiftType()
                    );

            if (!hasTenHourBreak(
                    existingStart,
                    existingEnd,
                    newStart,
                    newEnd
            )) {

                return ResponseEntity.badRequest()
                        .body(
                            "You must have at least 10 hours between shifts."
                        );
            }
        }

        DoctorSchedule schedule =
                new DoctorSchedule();

        schedule.setDoctor(doctor);
        schedule.setShiftDate(shiftDate);
        schedule.setShiftType(shiftType);

        DoctorSchedule saved =
                scheduleRepository.save(schedule);

        return ResponseEntity.ok(toResponse(saved));
    }

    private boolean isValidShiftForDay(
            LocalDate date,
            String shiftType
    ) {

        boolean sunday =
                date.getDayOfWeek() == DayOfWeek.SUNDAY;

        if (sunday) {
            return shiftType.equals("SUNDAY")
                    || shiftType.equals("OVERNIGHT");
        }

        return shiftType.equals("EARLY_MORNING")
                || shiftType.equals("EIGHT_THIRTY")
                || shiftType.equals("LATE_DOCTOR")
                || shiftType.equals("SURGERY")
                || shiftType.equals("OVERNIGHT");
    }

    private int getShiftCapacity(
            LocalDate date,
            String shiftType
    ) {

        DayOfWeek day =
                date.getDayOfWeek();

        if (day == DayOfWeek.SUNDAY) {
            return 1;
        }

        if ("EARLY_MORNING".equals(shiftType)) {

            if (day == DayOfWeek.SATURDAY) {
                return 3;
            }

            return 2;
        }

        if ("LATE_DOCTOR".equals(shiftType)
                && day == DayOfWeek.FRIDAY) {

            return 2;
        }

        return 1;
    }

    private LocalDateTime getStartTime(
            LocalDate date,
            String shiftType
    ) {

        return switch (shiftType) {

            case "EARLY_MORNING",
                 "SURGERY" ->
                    LocalDateTime.of(
                            date,
                            LocalTime.of(7, 30)
                    );

            case "EIGHT_THIRTY" ->
                    LocalDateTime.of(
                            date,
                            LocalTime.of(8, 30)
                    );

            case "LATE_DOCTOR" ->
                    LocalDateTime.of(
                            date,
                            LocalTime.of(9, 30)
                    );

            case "OVERNIGHT" ->
                    LocalDateTime.of(
                            date,
                            LocalTime.of(20, 0)
                    );

            case "SUNDAY" ->
                    LocalDateTime.of(
                            date,
                            LocalTime.of(8, 0)
                    );

            default ->
                    throw new IllegalArgumentException(
                            "Invalid shift type."
                    );
        };
    }

    private LocalDateTime getEndTime(
            LocalDate date,
            String shiftType
    ) {

        return switch (shiftType) {

            case "EARLY_MORNING",
                 "SURGERY" ->
                    LocalDateTime.of(
                            date,
                            LocalTime.of(18, 30)
                    );

            case "EIGHT_THIRTY" ->
                    LocalDateTime.of(
                            date,
                            LocalTime.of(19, 30)
                    );

            case "LATE_DOCTOR" ->
                    LocalDateTime.of(
                            date,
                            LocalTime.of(20, 30)
                    );

            case "OVERNIGHT" ->
                    LocalDateTime.of(
                            date.plusDays(1),
                            LocalTime.of(8, 0)
                    );

            case "SUNDAY" ->
                    LocalDateTime.of(
                            date,
                            LocalTime.of(20, 0)
                    );

            default ->
                    throw new IllegalArgumentException(
                            "Invalid shift type."
                    );
        };
    }

    private boolean hasTenHourBreak(
            LocalDateTime oldStart,
            LocalDateTime oldEnd,
            LocalDateTime newStart,
            LocalDateTime newEnd
    ) {

        if (!newStart.isBefore(oldStart)) {

            Duration breakTime =
                    Duration.between(oldEnd, newStart);

            return breakTime.toMinutes() >= 600;
        }

        Duration breakTime =
                Duration.between(newEnd, oldStart);

        return breakTime.toMinutes() >= 600;
    }

    private DoctorScheduleResponse toResponse(
            DoctorSchedule schedule
    ) {

        Doctor doctor =
                schedule.getDoctor();

        Login login =
                loginRepository
                        .findById(doctor.getLid())
                        .orElseThrow();

        LocalDateTime start =
                getStartTime(
                        schedule.getShiftDate(),
                        schedule.getShiftType()
                );

        LocalDateTime end =
                getEndTime(
                        schedule.getShiftDate(),
                        schedule.getShiftType()
                );

        return new DoctorScheduleResponse(
                schedule.getScheduleId(),
                doctor.getDoctorId(),
                login.getLname(),
                login.getRole(),
                schedule.getShiftDate(),
                schedule.getShiftType(),
                start.toString(),
                end.toString()
        );
    }
}