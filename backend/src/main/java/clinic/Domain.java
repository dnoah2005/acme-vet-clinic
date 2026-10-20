package clinic;

import java.time.*;

enum Role {
    ADMIN, DOCTOR, TECHNICIAN
}

enum ShiftType {
    EARLY, EIGHT_THIRTY, LATE, SUNDAY, OVERNIGHT, SURGERY
}

enum LeaveType {
    VACATION, SICK
}

record User(
        long id,
        String username,
        String fullName,
        Role role,
        boolean active,
        boolean mustChangePassword
) {}

record Shift(
        long id,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        ShiftType shiftType,
        int requiredDoctors,
        int requiredTechnicians
) {}

record Assignment(long shiftId, long userId) {}

record ApprovedWorkShiftRequest(
        long userId,
        LocalDate workDate,
        ShiftType shiftType
) {}

record Decision(boolean granted, String reason) {}

record LoginRequest(String username, String password) {}

record LoginResponse(User user, String token) {}

record NewUser(
        String username,
        String password,
        String fullName,
        Role role
) {}

record PasswordChange(String password) {}

record TimeOffInput(
        LeaveType leaveType,
        LocalDate startDate,
        LocalDate endDate
) {}

record WorkShiftInput(
        LocalDate workDate,
        ShiftType shiftType
) {}