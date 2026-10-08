
import { useState } from "react";
import Calendar from "./Calendar";
import SchedulingCalendar from "./SchedulingCalendar";
import "./DoctorDashboard.css";

function DoctorDashboard({ currentUser, onLogout }) {
  const [tab, setTab] = useState("schedule");

  return (
    <div className="doctor-dashboard">

      <div className="doctor-tabs">

        <button
          className={
            tab === "schedule"
              ? "active-tab"
              : ""
          }
          onClick={() => setTab("schedule")}
        >
          Schedule View
        </button>

        <button
          className={
            tab === "scheduling"
              ? "active-tab"
              : ""
          }
          onClick={() => setTab("scheduling")}
        >
          Scheduling
        </button>

        <button
          className="logout-tab"
          onClick={onLogout}
        >
          Log Out
        </button>

      </div>

      <div className="doctor-dashboard-content">

        {tab === "schedule" && (
          <Calendar
            currentUser={currentUser}
          />
        )}

        {tab === "scheduling" && (
          <SchedulingCalendar
            currentUser={currentUser}
          />
        )}

      </div>

    </div>
  );
}

export default DoctorDashboard;
