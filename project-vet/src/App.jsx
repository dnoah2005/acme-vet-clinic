
import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [page, setPage] = useState("welcome");
  const [backendMessage, setBackendMessage] = useState("");

  const [signupData, setSignupData] = useState({
    lname: "",
    lusername: "",
    lemail: "",
    lpassword: "",
    role: ""
  });

  const [signupMessage, setSignupMessage] = useState("");

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

    try {
      const response = await fetch("http://localhost:8080/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(signupData)
      });

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
        setSignupMessage("Error creating account.");
      }
    } catch (error) {
      setSignupMessage("Could not connect to the backend.");
      console.error(error);
    }
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

            <p>
              Caring for your pets, every step of the way.
            </p>

            <p>{backendMessage}</p>

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

            <form onSubmit={handleSignupSubmit}>
              <label>Full Name</label>
              <input
                type="text"
                name="lname"
                placeholder="Enter your name"
                value={signupData.lname}
                onChange={handleSignupChange}
                required
              />

              <label>Username</label>
              <input
                type="text"
                name="lusername"
                placeholder="Create a username"
                value={signupData.lusername}
                onChange={handleSignupChange}
                required
              />

              <label>Role</label>
              <select
                name="role"
                value={signupData.role}
                onChange={handleSignupChange}
                required
              >
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
                name="lemail"
                placeholder="Enter your email"
                value={signupData.lemail}
                onChange={handleSignupChange}
                required
              />

              <label>Password</label>
              <input
                type="password"
                name="lpassword"
                placeholder="Create a password"
                value={signupData.lpassword}
                onChange={handleSignupChange}
                required
              />

              <button className="primary-button" type="submit">
                Sign Up
              </button>
            </form>

            <p>{signupMessage}</p>

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