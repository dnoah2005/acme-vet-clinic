package vet_clinic;

public record DoctorTimeOffBalanceResponse(
        int year,
        long vacationUsed,
        long vacationRemaining,
        long sickUsed,
        long sickRemaining
) {
}