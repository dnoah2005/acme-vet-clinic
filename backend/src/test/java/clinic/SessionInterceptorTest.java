package clinic;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SessionInterceptorTest {
    @Test
    void rejectsUserIdThatDoesNotMatchSession() throws Exception {
        AuthSessions sessions = new AuthSessions();
        String token = sessions.issue(1);
        SessionInterceptor interceptor = new SessionInterceptor(
                sessions,
                new InMemoryRepository(new User(
                        1,
                        "doctor",
                        "Doctor",
                        Role.DOCTOR,
                        true,
                        false)));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/users/2/schedule");
        request.setMethod("GET");
        request.addHeader("X-User-Id", "2");
        request.addHeader("X-Auth-Token", token);
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertTrue(!interceptor.preHandle(request, response, new Object()));
        assertEquals(401, response.getStatus());
    }

    @Test
    void requiresInitialAdminToChangePasswordBeforeUsingApi() throws Exception {
        AuthSessions sessions = new AuthSessions();
        String token = sessions.issue(1);
        SessionInterceptor interceptor = new SessionInterceptor(
                sessions,
                new InMemoryRepository(new User(
                        1,
                        "admin",
                        "Administrator",
                        Role.ADMIN,
                        true,
                        true)));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/users");
        request.setMethod("GET");
        request.addHeader("X-User-Id", "1");
        request.addHeader("X-Auth-Token", token);
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertTrue(!interceptor.preHandle(request, response, new Object()));
        assertEquals(403, response.getStatus());

        request.setRequestURI("/api/users/1/password");
        request.setMethod("PUT");
        response = new MockHttpServletResponse();

        assertTrue(interceptor.preHandle(request, response, new Object()));
    }

    private static class InMemoryRepository extends Repository {
        private final User user;

        InMemoryRepository(User user) {
            super(null);
            this.user = user;
        }

        @Override
        Optional<User> user(long id) {
            return id == user.id() ? Optional.of(user) : Optional.empty();
        }
    }
}
