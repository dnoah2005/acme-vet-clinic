package vet_clinic;

import java.time.LocalDate;

public record DoctorScheduleResponse(
        Integer scheduleId,
        Integer doctorId,
        String doctorName,
        String role,
        LocalDate shiftDate,
        String shiftType,
        String start,
        String end
) {
}