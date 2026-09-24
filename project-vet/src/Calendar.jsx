import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";

function Calendar() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "40px",
        boxSizing: "border-box",
        backgroundColor: "white",
        color: "black"
      }}
    >
      <h1
        style={{
          textAlign: "center",
          color: "black",
          marginBottom: "30px"
        }}
      >
        ACME Vet Clinic Calendar
      </h1>

      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        height="auto"
      />
    </div>
  );
}

export default Calendar;