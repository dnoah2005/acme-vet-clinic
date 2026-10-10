package clinic;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
class ApiController {
    private final ApiService service;

    ApiController(ApiService s) {
        service = s;
    }

    @GetMapping("/health")
    Map<String, String> health() {
    return Map.of("status", "ok");
}
    @PostMapping("/auth/login")
    LoginResponse login(@RequestBody LoginRequest x) {
        return new LoginResponse(service.login(x));
    }

    @PutMapping("/users/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void changePassword(@RequestHeader("X-User-Id") long actor, @PathVariable long id, @RequestBody PasswordChange x) {
        if (actor != id)
            throw new ApiException(403, "You can only change your own password");
        service.changeOwnPassword(id, x.password());
    }

    @GetMapping("/users")
    List<User> users(@RequestHeader("X-User-Id") long actor) {
        return service.users(actor);
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    User createUser(@RequestHeader("X-User-Id") long actor, @RequestBody NewUser x) {
        return service.createUser(actor, x);
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeUser(@RequestHeader("X-User-Id") long actor, @PathVariable long id) {
        service.removeUser(actor, id);
    }

    @PutMapping("/admin/users/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void resetPassword(@RequestHeader("X-User-Id") long actor, @PathVariable long id, @RequestBody PasswordChange x) {
        service.setPassword(actor, id, x.password());
    }

    @PostMapping("/schedules/regenerate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void regenerate(@RequestHeader("X-User-Id") long actor) {
        service.regenerate(actor);
    }

    @GetMapping("/users/{id}/schedule")
    List<Map<String, Object>> schedule(@RequestHeader("X-User-Id") long actor, @PathVariable long id,
            @RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to) {
        return service.schedule(actor, id, from, to);
    }

    @GetMapping("/users/{id}/leave-balance")
    Map<String, Integer> balance(@RequestHeader("X-User-Id") long actor, @PathVariable long id,
            @RequestParam(defaultValue = "0") int year) {
        return service.leaveBalance(actor, id, year);
    }

    @PostMapping("/users/{id}/time-off")
    Decision request(@RequestHeader("X-User-Id") long actor, @PathVariable long id, @RequestBody TimeOffInput x) {
        if (actor != id)
            throw new ApiException(403, "You can only request your own leave");
        return service.requestLeave(id, x);
    }
}

@RestControllerAdvice
class Errors {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, String>> api(ApiException e) {
        return ResponseEntity.status(e.status).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    ResponseEntity<Map<String, String>> conflict() {
        return ResponseEntity.badRequest()
                .body(Map.of("error", "That username is already in use or the request has invalid data"));
    }
}


class ApiException extends RuntimeException {
    final int status;

    ApiException(int s, String m) {
        super(m);
        status = s;
    }
}
