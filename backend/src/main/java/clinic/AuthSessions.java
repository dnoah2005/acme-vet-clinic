package clinic;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.UUID;

class AuthSessions {
    private final ConcurrentMap<String, Long> usersByToken =
            new ConcurrentHashMap<>();

    String issue(long userId) {
        String token = UUID.randomUUID().toString();
        usersByToken.put(token, userId);
        return token;
    }

    Long userId(String token) {
        return token == null ? null : usersByToken.get(token);
    }

    void revoke(String token) {
        if (token != null) {
            usersByToken.remove(token);
        }
    }
}

class SessionInterceptor implements HandlerInterceptor {
    private final AuthSessions sessions;
    private final Repository repo;

    SessionInterceptor(AuthSessions sessions, Repository repo) {
        this.sessions = sessions;
        this.repo = repo;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler) throws IOException {

        String path = request.getRequestURI();

        if (request.getMethod().equals("OPTIONS")
            || path.equals("/api/health")
                || path.equals("/api/auth/login")) {
            return true;
        }

        String token = request.getHeader("X-Auth-Token");
        String actorHeader = request.getHeader("X-User-Id");
        Long sessionUser = sessions.userId(token);
        long actor;

        try {
            actor = Long.parseLong(actorHeader);
        } catch (RuntimeException e) {
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "A valid login session is required");
        }

        if (sessionUser == null || sessionUser != actor) {
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "A valid login session is required");
        }

        User user = repo.user(actor)
                .filter(User::active)
                .orElse(null);

        if (user == null) {
            sessions.revoke(token);
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "A valid login session is required");
        }

        boolean changingOwnPassword = request.getMethod().equals("PUT")
                && path.equals("/api/users/" + actor + "/password");

        if (user.mustChangePassword() && !changingOwnPassword) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN,
                    "Change your password before continuing");
        }

        return true;
    }

    private boolean reject(
            HttpServletResponse response,
            int status,
            String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"error\":\"" + message + "\"}");
        return false;
    }
}
