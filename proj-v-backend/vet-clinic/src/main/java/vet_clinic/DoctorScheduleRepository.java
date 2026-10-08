package vet_clinic;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DoctorScheduleRepository
        extends JpaRepository<DoctorSchedule, Integer> {

    List<DoctorSchedule> findByShiftDateBetween(
            LocalDate start,
            LocalDate end
    );

    List<DoctorSchedule> findByDoctor_DoctorIdAndShiftDateBetween(
            Integer doctorId,
            LocalDate start,
            LocalDate end
    );

    long countByDoctor_DoctorIdAndShiftDateBetween(
            Integer doctorId,
            LocalDate start,
            LocalDate end
    );

    long countByDoctor_DoctorIdAndShiftDateBetweenAndShiftType(
            Integer doctorId,
            LocalDate start,
            LocalDate end,
            String shiftType
    );

    long countByShiftDateAndShiftType(
            LocalDate shiftDate,
            String shiftType
    );

    boolean existsByDoctor_DoctorIdAndShiftDateAndShiftType(
            Integer doctorId,
            LocalDate shiftDate,
            String shiftType
    );
}