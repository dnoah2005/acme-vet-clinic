package vet_clinic;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class VetClinicController {

    private final LoginRepository loginRepository;
    private final DoctorRepository doctorRepository;

    public VetClinicController(
            LoginRepository loginRepository,
            DoctorRepository doctorRepository
    ) {
        this.loginRepository = loginRepository;
        this.doctorRepository = doctorRepository;
    }

    @GetMapping("/")
    public String welcome() {
        return "Your pet is our number one priority";
    }

    @PostMapping("/signup")
    public Login signup(@RequestBody Login login) {

        Login savedLogin = loginRepository.save(login);

        if ("doctor".equals(savedLogin.getRole())) {
            Doctor doctor = new Doctor();
            doctor.setLid(savedLogin.getLid());
            doctorRepository.save(doctor);
        }

        return savedLogin;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Login login) {

        Optional<Login> found =
                loginRepository.findByLusername(login.getLusername());

        if (found.isEmpty()
                || !found.get().getLpassword().equals(login.getLpassword())) {

            return ResponseEntity
                    .status(401)
                    .body("Invalid username or password");
        }

        Login user = found.get();

        Integer doctorId = null;

        if ("doctor".equals(user.getRole())) {

            Optional<Doctor> doctor =
                    doctorRepository.findByLid(user.getLid());

            if (doctor.isEmpty()) {
                return ResponseEntity
                        .badRequest()
                        .body("Doctor account is not configured.");
            }

            doctorId = doctor.get().getDoctorId();
        }

        return ResponseEntity.ok(
                new LoginResponse(
                        user.getLid(),
                        doctorId,
                        user.getLname(),
                        user.getRole()
                )
        );
    }
}