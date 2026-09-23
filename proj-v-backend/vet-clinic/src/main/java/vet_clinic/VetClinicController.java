package vet_clinic;

import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class VetClinicController {

    private final LoginRepository loginRepository;

    public VetClinicController(LoginRepository loginRepository) {
        this.loginRepository = loginRepository;
    }

    @GetMapping("/")
    public String welcome() {
        return "Welcome to ACME Vet Clinic Backend!";
    }

    @PostMapping("/signup")
    public Login signup(@RequestBody Login login) {
        return loginRepository.save(login);
    }
}