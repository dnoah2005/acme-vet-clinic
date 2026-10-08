
import DoctorDashboard from "./DoctorDashboard";
import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [page, setPage] = useState("welcome");
  const [backendMessage, setBackendMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [signupData, setSignupData] = useState({
    lname: "",
    lusername: "",
    lemail: "",
    lpassword: "",
    role: ""
  });

  const [signupMessage, setSignupMessage] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:8080/")
      .then((response) => response.text())
      .then((data) => {
        setBackendMessage(data);
      })
      .catch((error) => {
        console.error("Error connecting to backend:", error);
      });
  }, []);

  const handleSignupChange = (event) => {
    const { name, value } = event.target;

    setSignupData({
      ...signupData,
      [name]: value
    });
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();

    setSignupMessage("");

    try {
      const response = await fetch(
        "http://localhost:8080/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(signupData)
        }
      );

      const message = await response.text();

      if (response.ok) {
        setSignupMessage("Account created successfully!");

        setSignupData({
          lname: "",
          lusername: "",
          lemail: "",
          lpassword: "",
          role: ""
        });
      } else {
        setSignupMessage(
          message || "Error creating account."
        );
      }
    } catch (error) {
      console.error(error);

      setSignupMessage(
        "Could not connect to the backend."
      );
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();

    setLoginMessage("");

    const username = event.target.username.value;
    const password = event.target.password.value;

    try {
      const response = await fetch(
        "http://localhost:8080/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            lusername: username,
            lpassword: password
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setLoginMessage(
          data.message ||
          "Invalid username or password."
        );

        return;
      }

      console.log("Login response:", data);

      if (data.role === "doctor") {
        setCurrentUser(data);
        setPage("doctor");
      } else {
        setLoginMessage(
          "Login successful, but this account does not have doctor access."
        );
      }
    } catch (error) {
      console.error(error);

      setLoginMessage(
        "Could not connect to the backend."
      );
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginMessage("");
    setSignupMessage("");
    setPage("welcome");
  };

  return (
    <div className="app">

      {page === "welcome" && (
        <div className="page-container">

          <div className="welcome-card">

            <div className="clinic-logo">
              🐾
            </div>

            <h1>
              Welcome to ACME Vet Clinic
            </h1>

            <p className="welcome-subtitle">
              Caring for your pets, every step of the way
            </p>

            {backendMessage && (
              <p className="backend-message">
                {backendMessage}
              </p>
            )}

            <div className="welcome-buttons">

              <button
                className="primary-button"
                onClick={() => {
                  setLoginMessage("");
                  setPage("login");
                }}
              >
                Login
              </button>

              <button
                className="secondary-button"
                onClick={() => {
                  setSignupMessage("");
                  setPage("signup");
                }}
              >
                Sign Up
              </button>

            </div>

          </div>

        </div>
      )}

      {page === "login" && (
        <div className="page-container">

          <div className="form-card">

            <div className="clinic-logo">
              🐾
            </div>

            <h1>
              Welcome back to ACME Vet Clinic
            </h1>

            <form
              onSubmit={handleLoginSubmit}
              className="clinic-form"
            >

              <label>
                Username

                <input
                  name="username"
                  type="text"
                  required
                />
              </label>

              <label>
                Password

                <input
                  name="password"
                  type="password"
                  required
                />
              </label>

              <button
                type="submit"
                className="primary-button"
              >
                Login
              </button>

            </form>

            {loginMessage && (
              <p className="form-message">
                {loginMessage}
              </p>
            )}

            <button
              className="secondary-button"
              onClick={() => {
                setLoginMessage("");
                setPage("welcome");
              }}
            >
              Back to Home
            </button>

          </div>

        </div>
      )}

      {page === "signup" && (
        <div className="page-container">

          <div className="form-card">

            <div className="clinic-logo">
              🐾
            </div>

            <h1>
              Create an Account
            </h1>

            <p className="form-subtitle">
              Sign up for ACME Vet Clinic
            </p>

            <form
              onSubmit={handleSignupSubmit}
              className="clinic-form"
            >

              <label>
                Full Name

                <input
                  name="lname"
                  value={signupData.lname}
                  onChange={handleSignupChange}
                  type="text"
                  required
                />
              </label>

              <label>
                Username

                <input
                  name="lusername"
                  value={signupData.lusername}
                  onChange={handleSignupChange}
                  type="text"
                  required
                />
              </label>

              <label>
                Role

                <select
                  name="role"
                  value={signupData.role}
                  onChange={handleSignupChange}
                  required
                >
                  <option value="">
                    Select a role
                  </option>

                  <option value="hr">
                    HR
                  </option>

                  <option value="doctor">
                    Doctor
                  </option>

                  <option value="technician">
                    Technician
                  </option>
                </select>
              </label>

              <label>
                Email

                <input
                  name="lemail"
                  value={signupData.lemail}
                  onChange={handleSignupChange}
                  type="email"
                  required
                />
              </label>

              <label>
                Password

                <input
                  name="lpassword"
                  value={signupData.lpassword}
                  onChange={handleSignupChange}
                  type="password"
                  required
                />
              </label>

              <button
                type="submit"
                className="primary-button"
              >
                Sign Up
              </button>

            </form>

            {signupMessage && (
              <p className="form-message">
                {signupMessage}
              </p>
            )}

            <button
              className="secondary-button"
              onClick={() => {
                setSignupMessage("");
                setPage("welcome");
              }}
            >
              Back to Home
            </button>

          </div>

        </div>
      )}

      {page === "doctor" && (
        <DoctorDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

    </div>
  );
}

export default App;
