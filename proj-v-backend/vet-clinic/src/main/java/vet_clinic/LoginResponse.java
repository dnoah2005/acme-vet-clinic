package vet_clinic;

public record LoginResponse(
        Integer lid,
        Integer doctorId,
        String lname,
        String role
) {
}