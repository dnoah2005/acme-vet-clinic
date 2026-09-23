package vet_clinic;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface LoginRepository extends JpaRepository<Login, Integer> {

    Optional<Login> findByLusername(String lusername);

    boolean existsByLusername(String lusername);

    boolean existsByLemail(String lemail);
}