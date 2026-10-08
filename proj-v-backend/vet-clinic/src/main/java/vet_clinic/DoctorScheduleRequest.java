package vet_clinic;

import java.time.LocalDate;

public record DoctorScheduleRequest(
        LocalDate shiftDate,
        String shiftType
) {
}