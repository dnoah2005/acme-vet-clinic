package vet_clinic;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
public class DoctorTimeOffController {

    private final DoctorTimeOffRepository timeOffRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorScheduleRepository scheduleRepository;
    private final LoginRepository loginRepository;

    public DoctorTimeOffController(
            DoctorTimeOffRepository timeOffRepository,
            DoctorRepository doctorRepository,
            DoctorScheduleRepository scheduleRepository,
            LoginRepository loginRepository
    ) {
        this.timeOffRepository = timeOffRepository;
        this.doctorRepository = doctorRepository;
        this.scheduleRepository = scheduleRepository;
        this.loginRepository = loginRepository;
    }

    @GetMapping("/doctors/{doctorId}/time-off/balance")
    public ResponseEntity<?> getBalance(
            @PathVariable Integer doctorId
    ) {

        Optional<Doctor> doctor = doctorRepository.findById(doctorId);

        if (doctor.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body("Doctor does not exist.");
        }

        int year = LocalDate.now().getYear();

        LocalDate start = LocalDate.of(year, 1, 1);
        LocalDate end = LocalDate.of(year, 12, 31);

        long vacationUsed =
                timeOffRepository
                        .countByDoctor_DoctorIdAndRequestTypeAndStatusAndRequestDateBetween(
                                doctorId,
                                "VACATION",
                                "APPROVED",
                                start,
                                end
                        );

        long sickUsed =
                timeOffRepository
                        .countByDoctor_DoctorIdAndRequestTypeAndStatusAndRequestDateBetween(
                                doctorId,
                                "SICK",
                                "APPROVED",
                                start,
                                end
                        );

        return ResponseEntity.ok(
                new DoctorTimeOffBalanceResponse(
                        year,
                        vacationUsed,
                        Math.max(0, 8 - vacationUsed),
                        sickUsed,
                        Math.max(0, 4 - sickUsed)
                )
        );
    }

    @GetMapping("/doctors/{doctorId}/time-off")
    public ResponseEntity<?> getTimeOff(
            @PathVariable Integer doctorId
    ) {

        Optional<Doctor> doctor = doctorRepository.findById(doctorId);

        if (doctor.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body("Doctor does not exist.");
        }

        int year = LocalDate.now().getYear();

        List<DoctorTimeOff> requests =
                timeOffRepository
                        .findByDoctor_DoctorIdAndRequestDateBetweenAndStatus(
                                doctorId,
                                LocalDate.of(year, 1, 1),
                                LocalDate.of(year, 12, 31),
                                "APPROVED"
                        );

        return ResponseEntity.ok(requests);
    }

    @PostMapping("/doctors/{doctorId}/time-off")
    public ResponseEntity<?> requestTimeOff(
            @PathVariable Integer doctorId,
            @RequestBody DoctorTimeOffRequest request
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

        if (request.requestDate() == null
                || request.requestType() == null) {

            return ResponseEntity.badRequest()
                    .body("Date and request type are required.");
        }

        String requestType =
                request.requestType().toUpperCase();

        LocalDate requestDate =
                request.requestDate();

        LocalDate today = LocalDate.now();

        if (!requestType.equals("VACATION")
                && !requestType.equals("SICK")) {

            return ResponseEntity.badRequest()
                    .body("Invalid time-off request type.");
        }

        if (requestDate.isBefore(today)) {
            return deny(
                    doctor,
                    requestType,
                    requestDate,
                    null,
                    "Request is too late."
            );
        }

        if (timeOffRepository
                .existsByDoctor_DoctorIdAndRequestDateAndStatus(
                        doctorId,
                        requestDate,
                        "APPROVED"
                )) {

            return deny(
                    doctor,
                    requestType,
                    requestDate,
                    null,
                    "Your request cannot be granted because you already have approved time off on this date."
            );
        }

        if (requestType.equals("VACATION")) {

            if (requestDate.getYear() != today.getYear()) {
                return deny(
                        doctor,
                        requestType,
                        requestDate,
                        null,
                        "Vacation can only be scheduled during the current calendar year."
                );
            }

            LocalDate earliestVacation =
                    today.plusDays(14);

            if (requestDate.isBefore(earliestVacation)) {
                return deny(
                        doctor,
                        requestType,
                        requestDate,
                        null,
                        "Request is too late. Vacation must be requested at least 2 weeks in advance."
                );
            }

            long vacationUsed =
                    timeOffRepository
                            .countByDoctor_DoctorIdAndRequestTypeAndStatusAndRequestDateBetween(
                                    doctorId,
                                    "VACATION",
                                    "APPROVED",
                                    LocalDate.of(today.getYear(), 1, 1),
                                    LocalDate.of(today.getYear(), 12, 31)
                            );

            if (vacationUsed >= 8) {
                return deny(
                        doctor,
                        requestType,
                        requestDate,
                        null,
                        "You don't have any more vacation time."
                );
            }

            List<DoctorSchedule> existingSchedules =
                    scheduleRepository
                            .findByDoctor_DoctorIdAndShiftDateBetween(
                                    doctorId,
                                    requestDate,
                                    requestDate
                            );

            if (!existingSchedules.isEmpty()) {
                return deny(
                        doctor,
                        requestType,
                        requestDate,
                        existingSchedules.get(0).getShiftType(),
                        "Your request cannot be granted because it conflicts with a previous shift request that was granted."
                );
            }

            return approve(
                    doctor,
                    requestType,
                    requestDate,
                    null
            );
        }



        Optional<DoctorSchedule> scheduleOptional =
                scheduleRepository
                        .findByDoctor_DoctorIdAndShiftDateBetween(
                                doctorId,
                                requestDate,
                                requestDate
                        )
                        .stream()
                        .findFirst();

        if (scheduleOptional.isEmpty()) {
            return deny(
                    doctor,
                    requestType,
                    requestDate,
                    null,
                    "You can only call in sick for a shift you are scheduled to work."
            );
        }

        DoctorSchedule schedule =
                scheduleOptional.get();

        LocalDateTime shiftStart =
                getStartTime(
                        schedule.getShiftDate(),
                        schedule.getShiftType()
                );

        LocalDateTime now =
                LocalDateTime.now();

        Duration untilShift =
                Duration.between(now, shiftStart);

        long minutesUntilShift =
                untilShift.toMinutes();

        if (minutesUntilShift < 10) {
            return deny(
                    doctor,
                    requestType,
                    requestDate,
                    schedule.getShiftType(),
                    "Request is too late. Sick time must be called in at least 10 minutes before your shift."
            );
        }

        if (minutesUntilShift > 24 * 60) {
            return deny(
                    doctor,
                    requestType,
                    requestDate,
                    schedule.getShiftType(),
                    "Sick time can only be called in within 24 hours of your shift."
            );
        }

        int year = today.getYear();

        long sickUsed =
                timeOffRepository
                        .countByDoctor_DoctorIdAndRequestTypeAndStatusAndRequestDateBetween(
                                doctorId,
                                "SICK",
                                "APPROVED",
                                LocalDate.of(year, 1, 1),
                                LocalDate.of(year, 12, 31)
                        );

        if (sickUsed >= 4) {
            return deny(
                    doctor,
                    requestType,
                    requestDate,
                    schedule.getShiftType(),
                    "You don't have any more sick days."
            );
        }

        long doctorsOnShift =
                scheduleRepository.countByShiftDateAndShiftType(
                        schedule.getShiftDate(),
                        schedule.getShiftType()
                );

        if (doctorsOnShift <= 1) {
            return deny(
                    doctor,
                    requestType,
                    requestDate,
                    schedule.getShiftType(),
                    "We will be short on doctors if we grant your request."
            );
        }

        DoctorTimeOff saved =
                new DoctorTimeOff();

        saved.setDoctor(doctor);
        saved.setRequestType("SICK");
        saved.setRequestDate(requestDate);
        saved.setShiftType(schedule.getShiftType());
        saved.setStatus("APPROVED");
        saved.setReason("Sick request approved.");
        saved.setRequestedAt(LocalDateTime.now());

        timeOffRepository.save(saved);

        scheduleRepository.delete(schedule);

        return ResponseEntity.ok(
                "Sick day approved. Your shift has been removed from the schedule."
        );
    }

    private ResponseEntity<?> approve(
            Doctor doctor,
            String requestType,
            LocalDate requestDate,
            String shiftType
    ) {

        DoctorTimeOff saved =
                new DoctorTimeOff();

        saved.setDoctor(doctor);
        saved.setRequestType(requestType);
        saved.setRequestDate(requestDate);
        saved.setShiftType(shiftType);
        saved.setStatus("APPROVED");
        saved.setReason(
                requestType.equals("VACATION")
                        ? "Vacation request approved."
                        : "Sick request approved."
        );
        saved.setRequestedAt(LocalDateTime.now());

        timeOffRepository.save(saved);

        return ResponseEntity.ok(
                requestType.equals("VACATION")
                        ? "Vacation day approved."
                        : "Sick day approved."
        );
    }

    private ResponseEntity<?> deny(
            Doctor doctor,
            String requestType,
            LocalDate requestDate,
            String shiftType,
            String reason
    ) {

        DoctorTimeOff denied =
                new DoctorTimeOff();

        denied.setDoctor(doctor);
        denied.setRequestType(requestType);
        denied.setRequestDate(requestDate);
        denied.setShiftType(shiftType);
        denied.setStatus("DENIED");
        denied.setReason(reason);
        denied.setRequestedAt(LocalDateTime.now());

        timeOffRepository.save(denied);

        return ResponseEntity.badRequest()
                .body(reason);
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
}