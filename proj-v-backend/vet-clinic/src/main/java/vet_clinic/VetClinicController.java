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
        return "Your pet is our number one priority";
    }

    @PostMapping("/signup")
    public Login signup(@RequestBody Login login) {
        return loginRepository.save(login);
    }

    @PostMapping("/login")
    public String login(@RequestBody Login login) {
        return loginRepository.findByLusername(login.getLusername())
                .filter(user -> user.getLpassword().equals(login.getLpassword()))
                .map(user -> user.getRole())
                .orElse("Invalid username or password");
    }
}