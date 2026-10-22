import { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/AdminDashboard.css";

const API_URL = "http://localhost:8080/api";

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function twoWeeksLater() {
  const date = new Date();
  date.setDate(date.getDate() + 13);
  return localDateString(date);
}

function normalizeUser(person) {
  return {
    ...person,
    id: person.id ?? person.uid ?? person.userId,
    role: String(person.role || "").toUpperCase(),
    active: Boolean(person.active),
    mustChangePassword: Boolean(
      person.mustChangePassword ??
        person.must_change_password ??
        false
    ),
  };
}

function shiftName(type) {
  const labels = {
    EARLY: "Early Morning",
    EIGHT_THIRTY: "8:30 Shift",
    LATE: "Late Doctor",
    SURGERY: "Surgery",
    OVERNIGHT: "Overnight",
    SUNDAY: "Sunday Shift",
  };

  return labels[type] || String(type || "Shift").replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminDashboard({ currentUser, onLogout }) {
  const [user, setUser] = useState(() => {
    try {
      return normalizeUser(
        currentUser ||
          JSON.parse(localStorage.getItem("acmeUser") || "null")
      );
    } catch {
      return null;
    }
  });

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [scheduleRows, setScheduleRows] = useState([]);
  const [from, setFrom] = useState(localDateString(new Date()));
  const [to, setTo] = useState(twoWeeksLater());
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [activeTab, setActiveTab] = useState("employees");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newEmployee, setNewEmployee] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "DOCTOR",
  });

  const [resetPasswords, setResetPasswords] = useState({});
  const [assignmentChoices, setAssignmentChoices] = useState({});

  useEffect(() => {
    if (!currentUser) return undefined;

    const timer = window.setTimeout(
      () => setUser(normalizeUser(currentUser)),
      0
    );

    return () => window.clearTimeout(timer);
  }, [currentUser]);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-User-Id": String(user?.id ?? ""),
      "X-Auth-Token": user?.authToken ?? "",
    }),
    [user]
  );

  const api = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {}),
        },
      });

      if (response.status === 204) {
        if (!response.ok) {
          throw new Error("The request failed.");
        }

        return null;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Request failed (${response.status}).`
        );
      }

      return data;
    },
    [headers]
  );

  const loadEmployees = useCallback(async () => {
    const data = await api("/users");

    if (!Array.isArray(data)) {
      throw new Error("The server returned an invalid employee list.");
    }

    setEmployees(data.map(normalizeUser));
  }, [api]);

  const loadSchedule = useCallback(async () => {
    if (!from || !to) {
      setError("Choose both a start date and an end date.");
      return;
    }

    if (to < from) {
      setError("The end date must be on or after the start date.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const targets =
        selectedEmployee === "all"
          ? employees.filter(
              (person) =>
                person.role !== "ADMIN" && person.active
            )
          : employees.filter(
              (person) =>
                String(person.id) === selectedEmployee
            );

      const results = await Promise.all(
        targets.map(async (person) => {
          const rows = await api(
            `/users/${encodeURIComponent(person.id)}/schedule?from=${encodeURIComponent(
              from
            )}&to=${encodeURIComponent(to)}`
          );

          return rows.map((row) => ({
            ...row,
            employee: person,
          }));
        })
      );

      const uniqueShifts = new Map();

      for (const row of results.flat()) {
        const shift = row.shift;

        if (!shift) continue;

        const shiftId = shift.id ?? shift.sid;

        if (shiftId == null) continue;

        if (!uniqueShifts.has(String(shiftId))) {
          uniqueShifts.set(String(shiftId), {
            shift,
            employees: new Map(),
            coworkers: new Map(),
          });
        }

        const grouped = uniqueShifts.get(String(shiftId));

        grouped.employees.set(
          String(row.employee.id),
          row.employee
        );

        for (const coworker of row.coworkers || []) {
          grouped.coworkers.set(
            String(coworker.id),
            normalizeUser(coworker)
          );
        }
      }

      const normalizedRows = Array.from(
        uniqueShifts.entries()
      )
        .map(([shiftId, grouped]) => {
          for (const [id, person] of grouped.coworkers) {
            grouped.employees.set(id, person);
          }

          return {
            shiftId,
            shift: grouped.shift,
            assignedEmployees: Array.from(
              grouped.employees.values()
            ).filter((person) => person.role !== "ADMIN"),
          };
        })
        .sort((a, b) =>
          String(a.shift.startAt).localeCompare(
            String(b.shift.startAt)
          )
        );

      setScheduleRows(normalizedRows);
      setMessage(
        `Loaded ${normalizedRows.length} shifts for ${targets.length} employee${
          targets.length === 1 ? "" : "s"
        }.`
      );
    } catch (e) {
      setError(e.message || "Could not load the schedule.");
      setScheduleRows([]);
    } finally {
      setBusy(false);
    }
  }, [api, employees, from, to, selectedEmployee]);

  const generateSchedule = async () => {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await api("/admin/schedule/generate", { method: "POST" });
      setScheduleRows([]);
      setMessage(
        "The current week and next week were generated. Load the schedule below to review assignments."
      );
    } catch (e) {
      setError(
        e.message ||
          "Could not generate a complete two-week schedule. Verify that enough active staff are available."
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "ADMIN") {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadEmployees().catch((e) => setError(e.message));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [user, loadEmployees]);

  const createEmployee = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newEmployee.password.length < 8) {
      setError("The temporary password must contain at least 8 characters.");
      return;
    }

    setBusy(true);

    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: newEmployee.fullName.trim(),
          username: newEmployee.username.trim(),
          password: newEmployee.password,
          role: newEmployee.role,
        }),
      });

      setNewEmployee({
        fullName: "",
        username: "",
        password: "",
        role: "DOCTOR",
      });

      await loadEmployees();

      setMessage(
        "Employee account created. The employee must change their temporary password after logging in."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deactivateEmployee = async (person) => {
    if (
      !window.confirm(
        `Deactivate ${person.fullName}'s account?`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api(`/users/${person.id}`, {
        method: "DELETE",
      });

      await loadEmployees();

      setMessage(
        `${person.fullName}'s account has been deactivated.`
      );
    } catch (e) {
      setError(e.message);
    }
  };

  const resetPassword = async (person) => {
    const password = resetPasswords[person.id] || "";

    if (password.length < 8) {
      setError(
        "A new password must contain at least 8 characters."
      );
      return;
    }

    setError("");
    setMessage("");

    try {
      await api(`/admin/users/${person.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password }),
      });

      setResetPasswords((old) => ({
        ...old,
        [person.id]: "",
      }));

      await loadEmployees();

      setMessage(
        `Password reset for ${person.fullName}. They must change it at next login.`
      );
    } catch (e) {
      setError(e.message);
    }
  };

  const assignEmployee = async (row) => {
    const shiftId = row.shift.id ?? row.shift.sid;
    const userId = assignmentChoices[shiftId];

    if (!userId) {
      setError("Choose an employee before assigning the shift.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await api(
        `/admin/shifts/${encodeURIComponent(
          shiftId
        )}/assignments/${encodeURIComponent(userId)}`,
        { method: "PUT" }
      );

      setAssignmentChoices((old) => ({
        ...old,
        [shiftId]: "",
      }));

      await loadSchedule();

      const person = employees.find(
        (employee) => String(employee.id) === String(userId)
      );

      setMessage(
        `${person?.fullName || "Employee"} was assigned to ${shiftName(
          row.shift.shiftType
        )}.`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const unassignEmployee = async (row, person) => {
    const shiftId = row.shift.id ?? row.shift.sid;

    if (
      !window.confirm(
        `Remove ${person.fullName} from ${shiftName(
          row.shift.shiftType
        )}?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await api(
        `/admin/shifts/${encodeURIComponent(
          shiftId
        )}/assignments/${encodeURIComponent(person.id)}`,
        { method: "DELETE" }
      );

      await loadSchedule();

      setMessage(
        `${person.fullName} was removed from the shift.`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const showLeaveBalance = async (person) => {
    setSelectedEmployee(String(person.id));
    setError("");
    setMessage("");

    try {
      const balance = await api(
        `/users/${person.id}/leave-balance`
      );

      setLeaveBalance({
        person,
        ...balance,
      });

      setActiveTab("leave");
    } catch (e) {
      setError(e.message);
    }
  };

  const logout = () => {
    if (onLogout) {
      onLogout();
      return;
    }

    localStorage.removeItem("acmeUser");
    window.location.reload();
  };

  if (!user || user.role !== "ADMIN") {
    return (
      <main className="hr-dashboard">
        <section className="hr-panel">
          <h1>Administrator access required</h1>
          <p>
            Please log in with an administrator account to access
            employee and scheduling tools.
          </p>
          <button className="hr-button" onClick={logout}>
            Return to login
          </button>
        </section>
      </main>
    );
  }

  const staff = employees.filter(
    (person) => person.role === "DOCTOR" ||
      person.role === "TECHNICIAN"
  );

  return (
    <main className="hr-dashboard">
      <header className="hr-header">
        <div>
          <div className="hr-eyebrow">
            ACME VET CLINIC · STAFF OPERATIONS
          </div>
          <h1>HR &amp; Scheduling</h1>
          <p>
            Create employee accounts and manually manage shift assignments.
          </p>
        </div>

        <div className="hr-header-actions">
          <span className="hr-admin-pill">Administrator</span>
          <button
            className="hr-button hr-button-light"
            onClick={logout}
          >
            Log out
          </button>
        </div>
      </header>

      <nav className="hr-tabs" aria-label="HR sections">
        {[
          ["employees", "Employees"],
          ["create", "Add employee"],
          ["schedule", "Schedules"],
          ["leave", "Leave balances"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={
              activeTab === key ? "hr-tab active" : "hr-tab"
            }
            onClick={() => {
              setActiveTab(key);
              setError("");
              setMessage("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {message && (
        <div className="hr-notice" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="hr-error" role="alert">
          {error}
        </div>
      )}

      {activeTab === "employees" && (
        <section className="hr-panel">
          <div className="hr-panel-heading">
            <div>
              <h2>Employee directory</h2>
              <p>{staff.length} doctor and technician accounts</p>
            </div>

            <button
              className="hr-button"
              onClick={() => setActiveTab("create")}
            >
              + Add employee
            </button>
          </div>

          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Account actions</th>
                </tr>
              </thead>

              <tbody>
                {staff.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <strong>{person.fullName}</strong>
                      <small>ID #{person.id}</small>
                    </td>

                    <td>{person.username}</td>

                    <td>
                      <span
                        className={`hr-role role-${person.role.toLowerCase()}`}
                      >
                        {person.role === "DOCTOR"
                          ? "Doctor"
                          : "Technician"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          person.active
                            ? "hr-status active-status"
                            : "hr-status inactive-status"
                        }
                      >
                        {person.active ? "Active" : "Inactive"}
                      </span>

                      {person.mustChangePassword && (
                        <small>Password change required</small>
                      )}
                    </td>

                    <td>
                      <div className="hr-actions">
                        <button
                          className="hr-link-button"
                          onClick={() => showLeaveBalance(person)}
                        >
                          Leave balance
                        </button>

                        <div className="hr-reset-row">
                          <input
                            aria-label={`New password for ${person.fullName}`}
                            type="password"
                            minLength="8"
                            placeholder="New password"
                            value={resetPasswords[person.id] || ""}
                            onChange={(event) =>
                              setResetPasswords((old) => ({
                                ...old,
                                [person.id]: event.target.value,
                              }))
                            }
                          />

                          <button
                            className="hr-button hr-button-small"
                            onClick={() => resetPassword(person)}
                          >
                            Reset
                          </button>
                        </div>

                        {person.active && (
                          <button
                            className="hr-danger-button"
                            onClick={() => deactivateEmployee(person)}
                          >
                            Deactivate account
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {staff.length === 0 && (
                  <tr>
                    <td colSpan="5" className="hr-empty">
                      No doctors or technicians have been created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "create" && (
        <section className="hr-panel hr-create-panel">
          <div>
            <h2>Create employee account</h2>
            <p>
              Create a doctor or technician account. The employee will
              be required to change the temporary password after login.
            </p>
          </div>

          <form className="hr-form" onSubmit={createEmployee}>
            <label>
              Full name
              <input
                value={newEmployee.fullName}
                onChange={(event) =>
                  setNewEmployee({
                    ...newEmployee,
                    fullName: event.target.value,
                  })
                }
                required
                maxLength="120"
                placeholder="e.g. Jordan Lee"
              />
            </label>

            <label>
              Username
              <input
                value={newEmployee.username}
                onChange={(event) =>
                  setNewEmployee({
                    ...newEmployee,
                    username: event.target.value,
                  })
                }
                required
                maxLength="50"
                placeholder="Choose a username"
              />
            </label>

            <label>
              Temporary password
              <input
                type="password"
                value={newEmployee.password}
                onChange={(event) =>
                  setNewEmployee({
                    ...newEmployee,
                    password: event.target.value,
                  })
                }
                required
                minLength="8"
                placeholder="At least 8 characters"
              />
            </label>

            <label>
              Employee role
              <select
                value={newEmployee.role}
                onChange={(event) =>
                  setNewEmployee({
                    ...newEmployee,
                    role: event.target.value,
                  })
                }
              >
                <option value="DOCTOR">Doctor</option>
                <option value="TECHNICIAN">Technician</option>
              </select>
            </label>

            <button
              className="hr-button"
              type="submit"
              disabled={busy}
            >
              {busy ? "Saving…" : "Create account"}
            </button>
          </form>
        </section>
      )}

      {activeTab === "schedule" && (
        <section className="hr-panel">
          <div className="hr-panel-heading">
            <div>
              <h2>Manual schedule editor</h2>
              <p>
                Assign or remove doctors and technicians from existing
                shifts. Surgery shifts are highlighted.
              </p>
            </div>

            <button
              className="hr-button"
              onClick={generateSchedule}
              disabled={busy}
              type="button"
            >
              {busy ? "Generating…" : "Generate current + next week"}
            </button>
          </div>

          <p className="hr-footnote">
            Generate the schedule after creating the active roster and
            whenever you need a fresh two-week schedule. Generation keeps
            approved work-shift and time-off requests in effect.
          </p>

          <div className="hr-filters">
            <label>
              Employee filter
              <select
                value={selectedEmployee}
                onChange={(event) =>
                  setSelectedEmployee(event.target.value)
                }
              >
                <option value="all">All active staff</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName} ({person.role.toLowerCase()})
                  </option>
                ))}
              </select>
            </label>

            <label>
              From
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                required
              />
            </label>

            <label>
              To
              <input
                type="date"
                value={to}
                min={from}
                onChange={(event) => setTo(event.target.value)}
                required
              />
            </label>

            <button
              className="hr-button hr-button-secondary"
              onClick={loadSchedule}
              disabled={busy}
              type="button"
            >
              {busy ? "Loading…" : "Load schedule"}
            </button>
          </div>

          <div className="hr-table-wrap">
            <table className="hr-table hr-schedule-table">
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Assigned employees</th>
                  <th>Assign employee</th>
                </tr>
              </thead>

              <tbody>
                {scheduleRows
                  .filter((row) =>
                    selectedEmployee === "all" ||
                    row.assignedEmployees.some(
                      (person) =>
                        String(person.id) === selectedEmployee
                    )
                  )
                  .map((row) => {
                    const shiftId = row.shift.id ?? row.shift.sid;
                    const isSurgery =
                      row.shift.shiftType === "SURGERY";

                    const doctorsAssigned =
                      row.assignedEmployees.filter(
                        (person) => person.role === "DOCTOR"
                      ).length;

                    const techniciansAssigned =
                      row.assignedEmployees.filter(
                        (person) => person.role === "TECHNICIAN"
                      ).length;

                    const availableEmployees = staff.filter(
                      (person) => {
                        if (!person.active) return false;

                        if (
                          row.assignedEmployees.some(
                            (assigned) =>
                              String(assigned.id) === String(person.id)
                          )
                        ) {
                          return false;
                        }

                        if (
                          isSurgery &&
                          person.role !== "DOCTOR"
                        ) {
                          return false;
                        }

                        if (
                          person.role === "DOCTOR" &&
                          doctorsAssigned >=
                            row.shift.requiredDoctors
                        ) {
                          return false;
                        }

                        if (
                          person.role === "TECHNICIAN" &&
                          techniciansAssigned >=
                            row.shift.requiredTechnicians
                        ) {
                          return false;
                        }

                        return true;
                      }
                    );

                    return (
                      <tr
                        key={shiftId}
                        className={isSurgery ? "surgery-row" : ""}
                      >
                        <td>
                          <span
                            className={
                              isSurgery
                                ? "hr-shift surgery-shift"
                                : "hr-shift"
                            }
                          >
                            {shiftName(row.shift.shiftType)}
                          </span>

                          <small>
                            Doctors: {doctorsAssigned}/
                            {row.shift.requiredDoctors}
                            {" · "}
                            Technicians: {techniciansAssigned}/
                            {row.shift.requiredTechnicians}
                          </small>
                        </td>

                        <td>{formatDate(row.shift.startAt)}</td>
                        <td>{formatDate(row.shift.endAt)}</td>

                        <td>
                          {row.assignedEmployees.length === 0
                            ? "No assigned employees"
                            : row.assignedEmployees
                                .map(
                                  (person) =>
                                    `${person.fullName} (${person.role.toLowerCase()})`
                                )
                                .join(", ")}

                          <div className="hr-assigned-staff-list">
                            {row.assignedEmployees.map((person) => (
                              <div
                                className="hr-assigned-staff"
                                key={person.id}
                              >
                                <span>
                                  {person.fullName} ({person.role.toLowerCase()})
                                </span>
                                <button
                                  type="button"
                                  className="hr-remove-assignment"
                                  disabled={busy}
                                  onClick={() =>
                                    unassignEmployee(row, person)
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td>
                          <div className="hr-assignment-control">
                            <select
                              aria-label={`Employee to assign to ${shiftName(
                                row.shift.shiftType
                              )}`}
                              value={assignmentChoices[shiftId] || ""}
                              onChange={(event) =>
                                setAssignmentChoices((old) => ({
                                  ...old,
                                  [shiftId]: event.target.value,
                                }))
                              }
                            >
                              <option value="">
                                Choose employee
                              </option>

                              {availableEmployees.map((person) => (
                                <option
                                  key={person.id}
                                  value={person.id}
                                >
                                  {person.fullName} (
                                  {person.role.toLowerCase()})
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              className="hr-button hr-button-small"
                              disabled={
                                busy ||
                                !assignmentChoices[shiftId]
                              }
                              onClick={() => assignEmployee(row)}
                            >
                              Assign
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {scheduleRows.length === 0 && (
                  <tr>
                    <td colSpan="5" className="hr-empty">
                      No shifts were found for this date range. Load a
                      different date range or make sure shifts already
                      exist in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="hr-footnote">
            Assignments are checked by the backend for shift capacity,
            approved time off, required rest time, and doctor-specific
            surgery and overnight restrictions.
          </p>
        </section>
      )}

      {activeTab === "leave" && (
        <section className="hr-panel">
          <h2>Leave balances</h2>
          <p>
            The annual allowance is 8 vacation days and 4 sick days
            per employee.
          </p>

          <label className="hr-leave-select">
            Select employee
            <select
              value={leaveBalance?.person?.id ?? ""}
              onChange={async (event) => {
                const person = staff.find(
                  (item) =>
                    String(item.id) === event.target.value
                );

                if (!person) {
                  setLeaveBalance(null);
                  return;
                }

                try {
                  const balance = await api(
                    `/users/${person.id}/leave-balance`
                  );

                  setLeaveBalance({
                    person,
                    ...balance,
                  });
                  setError("");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <option value="">Choose an employee</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName} ({person.role.toLowerCase()})
                </option>
              ))}
            </select>
          </label>

          {leaveBalance ? (
            <div className="hr-balance-grid">
              <div className="hr-balance-card">
                <span>Vacation remaining</span>
                <strong>{leaveBalance.vacationRemaining}</strong>
                <small>
                  {leaveBalance.vacationUsed} of 8 days used
                </small>
              </div>

              <div className="hr-balance-card">
                <span>Sick days remaining</span>
                <strong>{leaveBalance.sickRemaining}</strong>
                <small>
                  {leaveBalance.sickUsed} of 4 days used
                </small>
              </div>

              <div className="hr-balance-card">
                <span>Employee</span>
                <strong className="hr-balance-name">
                  {leaveBalance.person.fullName}
                </strong>
                <small>{leaveBalance.person.role}</small>
              </div>
            </div>
          ) : (
            <div className="hr-empty hr-leave-empty">
              Choose an employee to view their leave balance.
            </div>
          )}
        </section>
      )}

      <footer className="hr-footer">
        ACME Vet Clinic · Staff management and scheduling are available
        to administrator accounts only.
      </footer>
    </main>
  );
}

export default AdminDashboard;
