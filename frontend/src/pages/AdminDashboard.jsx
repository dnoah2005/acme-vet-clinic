import { useState } from "react";
import Calendar from "./Calendar";
import "../styles/AdminDashboard.css";
import SchedulingCalendar from "./SchedulingCalendar";

function AdminDashboard() {
  return (
    <div className="form-page">
      <div className="form-card">
        <h2>Administrator Dashboard</h2>

        <p>
          Create doctor and technician accounts, manage staff,
          and generate schedules here.
        </p>

        <button className="primary-button">
          Generate Two-Week Schedule
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;