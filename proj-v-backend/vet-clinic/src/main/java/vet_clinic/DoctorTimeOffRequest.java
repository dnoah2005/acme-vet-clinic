package vet_clinic;

import java.time.LocalDate;

public record DoctorTimeOffRequest(
        LocalDate requestDate,
        String requestType
) {
}