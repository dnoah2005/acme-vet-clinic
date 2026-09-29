import { useState } from "react";
import Calendar from "./Calendar";
import "./DoctorDashboard.css";
import SchedulingCalendar from "./SchedulingCalendar";

function DoctorDashboard() {
  const [tab, setTab] = useState("schedule");

  return (
    <div className="doctor-dashboard">
      <div className="doctor-tabs">
        <button
          className={tab === "schedule" ? "active-tab" : ""}
          onClick={() => setTab("schedule")}
        >
          Schedule View
        </button>

        <button
          className={tab === "scheduling" ? "active-tab" : ""}
          onClick={() => setTab("scheduling")}
        >
          Scheduling
        </button>
      </div>

     {tab === "schedule" && <Calendar />}
     {tab === "scheduling" && <SchedulingCalendar />}
    </div>
  );
}

export default DoctorDashboard;