
import { useState } from "react";
import "./App.css";

function App() {
  const [page, setPage] = useState("welcome");

  return (
    <div className="app">
      {page === "welcome" && (
        <div className="welcome-page">
          <div className="welcome-card">
            <div className="logo">🐾</div>

            <h1 className="clinic-title">
              Welcome to ACME Vet Clinic
            </h1>

            <p>
              Caring for your pets, every step of the way.
            </p>

            <div className="button-container">
              <button
                className="primary-button"
                onClick={() => setPage("login")}
              >
                Login
              </button>

              <button
                className="secondary-button"
                onClick={() => setPage("signup")}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      )}

      {page === "login" && (
        <div className="form-page">
          <div className="form-card">
            <h2 className="login-title">
              Login
            </h2>

            <p>Welcome back to ACME Vet Clinic.</p>

            <form>
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter your username"
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
              />

              <button className="primary-button" type="submit">
                Login
              </button>
            </form>

            <button
              className="back-button"
              onClick={() => setPage("welcome")}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {page === "signup" && (
        <div className="form-page">
          <div className="form-card">
            <h2 className="sign-up-title">
              Create an Account
            </h2>

            <p>Sign up for ACME Vet Clinic.</p>

            <form>
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter your name"
              />

              <label>Username</label>
              <input
                type="text"
                placeholder="Create a username"
              />

              <label>Role</label>
              <select defaultValue="">
                <option value="" disabled>
                  Select your role
                </option>
                <option value="hr">HR</option>
                <option value="doctor">Doctor</option>
                <option value="technician">Technician</option>
              </select>

              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Create a password"
              />

              <button className="primary-button" type="submit">
                  Sign Up
                </button>
              </form>

            <button
              className="back-button"
              onClick={() => setPage("welcome")}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;