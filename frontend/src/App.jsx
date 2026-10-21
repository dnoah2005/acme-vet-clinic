import { useEffect, useState } from "react";
import DoctorDashboard from "./pages/DoctorDashboard";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import "./styles/App.css";

const API_URL = "http://localhost:8080/api";

function normalizeUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  return {
    ...user,
    id: user.id ?? user.uid ?? user.userId,
    role: String(user.role || "").toUpperCase(),
    mustChangePassword: Boolean(
      user.mustChangePassword ??
        user.must_change_password ??
        false
    ),
  };
}

function readSavedUser() {
  try {
    const savedUser = localStorage.getItem("acmeUser");

    if (!savedUser) {
      return null;
    }

    const user = normalizeUser(JSON.parse(savedUser));

    if (!user?.authToken) {
      localStorage.removeItem("acmeUser");
      return null;
    }

    return user;
  } catch {
    localStorage.removeItem("acmeUser");
    return null;
  }
}

function App() {
  const [page, setPage] = useState("welcome");
  const [backendMessage, setBackendMessage] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(readSavedUser);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const mustChangeAdminPassword =
    currentUser?.role === "ADMIN" &&
    currentUser?.mustChangePassword === true;

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend health check failed.");
        }

        return response.json();
      })
      .then((data) => {
        setBackendMessage(data.status || "Backend connected");
      })
      .catch((error) => {
        console.error("Error connecting to backend:", error);
        setBackendMessage("Backend unavailable");
      });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setPage("welcome");
      return;
    }

    if (currentUser.role === "DOCTOR") {
      setPage("doctor");
    } else if (currentUser.role === "TECHNICIAN") {
      setPage("technician");
    } else if (currentUser.role === "ADMIN") {
      setPage("admin");
    } else {
      setPage("welcome");
    }
  }, [currentUser]);

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginMessage("");

    const username = event.target.username.value.trim();
    const password = event.target.password.value;

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginMessage(
          data.error || data.message || "Invalid username or password."
        );
        return;
      }

      if (!data.user || !data.token) {
        setLoginMessage("The server did not return a valid login session.");
        return;
      }

      const returnedUser = normalizeUser(data.user);

      if (
        !["DOCTOR", "TECHNICIAN", "ADMIN"].includes(returnedUser.role)
      ) {
        setLoginMessage(
          `Login successful, but the account role is unsupported: ${
            returnedUser.role || "unknown"
          }.`
        );
        return;
      }

      const needsPasswordChange =
        returnedUser.role === "ADMIN" &&
        (
          returnedUser.mustChangePassword ||
          (
            username.toLowerCase() === "admin" &&
            password === "admin"
          )
        );

      const user = {
        ...returnedUser,
        authToken: data.token,
        mustChangePassword: needsPasswordChange,
      };

      localStorage.setItem("acmeUser", JSON.stringify(user));
      setCurrentUser(user);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("");
    } catch (error) {
      console.error("Login failed:", error);
      setLoginMessage("Could not connect to the backend.");
    }
  };

  const handleAdminPasswordChange = async (event) => {
    event.preventDefault();
    setPasswordMessage("");

    if (!currentUser?.id) {
      setPasswordMessage(
        "Your account ID is missing. Please log out and log in again."
      );
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage(
        "Your new password must be at least 8 characters long."
      );
      return;
    }

    if (newPassword === "admin") {
      setPasswordMessage(
        "Choose a new password instead of keeping the temporary password."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("The passwords do not match.");
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch(
        `${API_URL}/users/${encodeURIComponent(currentUser.id)}/password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": String(currentUser.id),
            "X-Auth-Token": currentUser.authToken,
          },
          body: JSON.stringify({
            password: newPassword,
          }),
        }
      );

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Password change failed (HTTP ${response.status}).`
        );
      }

      const updatedUser = {
        ...currentUser,
        mustChangePassword: false,
        must_change_password: false,
      };

      localStorage.setItem("acmeUser", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("");
    } catch (error) {
      console.error("Password change failed:", error);
      setPasswordMessage(
        error.message || "Could not change the password."
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    if (currentUser?.id && currentUser?.authToken) {
      fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "X-User-Id": String(currentUser.id),
          "X-Auth-Token": currentUser.authToken,
        },
      }).catch((error) => {
        console.error("Could not revoke login session:", error);
      });
    }

    localStorage.removeItem("acmeUser");
    setCurrentUser(null);
    setLoginMessage("");
    setPasswordMessage("");
    setNewPassword("");
    setConfirmPassword("");
    setPage("welcome");
  };

  return (
    <div className="app">
      {page === "welcome" && (
        <div className="welcome-page">
          <div className="welcome-card">
            <div className="logo">🐾</div>

            <h1 className="clinic-title">
              Welcome to ACME Vet Clinic
            </h1>

            <p>Your pets are our number 1 priority.</p>

            <div className="button-container">
              <button
                className="primary-button"
                onClick={() => {
                  setLoginMessage("");
                  setPage("login");
                }}
              >
                Login
              </button>
            </div>
          </div>
        </div>
      )}

      {page === "login" && (
        <div className="form-page">
          <div className="form-card">
            <h2 className="login-title">Login</h2>
            <p>Welcome back to ACME Vet Clinic.</p>

            <form onSubmit={handleLoginSubmit}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                name="username"
                placeholder="Enter your username"
                autoComplete="username"
                required
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />

              <button className="primary-button" type="submit">
                Login
              </button>
            </form>

            {loginMessage && (
              <p className="error-message" role="alert">
                {loginMessage}
              </p>
            )}

            <button
              className="back-button"
              onClick={() => setPage("welcome")}
              type="button"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {page === "doctor" && currentUser && (
        <DoctorDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {page === "technician" && currentUser && (
        <TechnicianDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {page === "admin" && currentUser && (
        <AdminDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {mustChangeAdminPassword && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-password-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            backgroundColor: "rgba(0, 0, 0, 0.72)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "28px",
              borderRadius: "14px",
              background: "#ffffff",
              color: "#1f2937",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            <h2 id="admin-password-title">
              Change the temporary admin password
            </h2>

            <p>
              Before you can use the admin dashboard, replace the
              temporary password with a new password of at least
              8 characters.
            </p>

            <form onSubmit={handleAdminPasswordChange}>
              <label htmlFor="new-admin-password">
                New password
              </label>
              <input
                id="new-admin-password"
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                autoComplete="new-password"
                minLength={8}
                required
                disabled={changingPassword}
                style={{
                  display: "block",
                  boxSizing: "border-box",
                  width: "100%",
                  margin: "8px 0 16px",
                  padding: "12px",
                }}
              />

              <label htmlFor="confirm-admin-password">
                Confirm new password
              </label>
              <input
                id="confirm-admin-password"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                minLength={8}
                required
                disabled={changingPassword}
                style={{
                  display: "block",
                  boxSizing: "border-box",
                  width: "100%",
                  margin: "8px 0 16px",
                  padding: "12px",
                }}
              />

              {passwordMessage && (
                <p role="alert" style={{ color: "#b91c1c" }}>
                  {passwordMessage}
                </p>
              )}

              <button
                className="primary-button"
                type="submit"
                disabled={changingPassword}
                style={{ width: "100%" }}
              >
                {changingPassword
                  ? "Changing password…"
                  : "Change Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;