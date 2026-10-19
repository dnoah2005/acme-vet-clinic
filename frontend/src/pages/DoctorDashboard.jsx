
import { useEffect, useState } from "react";
import Calendar from "./Calendar";
import SchedulingCalendar from "./SchedulingCalendar";
import "../styles/DoctorDashboard.css";

function DoctorDashboard({ currentUser, onLogout }) {
  const storageKey = `acmeDoctorTab-${currentUser?.id ?? currentUser?.uid ?? "user"}`;

  const [tab, setTab] = useState(() => {
    const savedTab = localStorage.getItem(storageKey);

    return ["schedule", "scheduling"].includes(savedTab)
      ? savedTab
      : "schedule";
  });

  useEffect(() => {
    localStorage.setItem(storageKey, tab);
  }, [storageKey, tab]);

  return (
    <div className="doctor-dashboard">
      <div className="doctor-tabs">
        <button
          type="button"
          className={tab === "schedule" ? "active-tab" : ""}
          onClick={() => setTab("schedule")}
        >
          Schedule View
        </button>

        <button
          type="button"
          className={tab === "scheduling" ? "active-tab" : ""}
          onClick={() => setTab("scheduling")}
        >
          Scheduling
        </button>

        <button
          type="button"
          className="logout-tab"
          onClick={onLogout}
        >
          Log Out
        </button>
      </div>

      <main className="doctor-dashboard-content">
        {tab === "schedule" && (
          <Calendar currentUser={currentUser} />
        )}

        {tab === "scheduling" && (
          <SchedulingCalendar currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}

export default DoctorDashboard;
