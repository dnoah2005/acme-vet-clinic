package vet_clinic;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DoctorTimeOffRepository
        extends JpaRepository<DoctorTimeOff, Integer> {

    long countByDoctor_DoctorIdAndRequestTypeAndStatusAndRequestDateBetween(
            Integer doctorId,
            String requestType,
            String status,
            LocalDate start,
            LocalDate end
    );

    boolean existsByDoctor_DoctorIdAndRequestDateAndStatus(
            Integer doctorId,
            LocalDate requestDate,
            String status
    );

    List<DoctorTimeOff> findByDoctor_DoctorIdAndRequestDateBetweenAndStatus(
            Integer doctorId,
            LocalDate start,
            LocalDate end,
            String status
    );
}