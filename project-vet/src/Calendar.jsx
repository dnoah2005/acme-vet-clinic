
import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";

import "./Calendar.css";

function Calendar({ currentUser }) {
  const calendarRef = useRef(null);

  const [calendarTitle, setCalendarTitle] = useState("");
  const [mySchedules, setMySchedules] = useState({});

  const getColor = (shiftType) => {
    switch (shiftType) {
      case "SURGERY":
        return "#dc2626";
      case "EARLY_MORNING":
        return "#16a34a";
      case "EIGHT_THIRTY":
        return "#2563eb";
      case "LATE_DOCTOR":
        return "#ea580c";
      case "OVERNIGHT":
        return "#7c3aed";
      case "SUNDAY":
        return "#0891b2";
      default:
        return "#555555";
    }
  };

  const getTodayString = () => {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const handlePrevious = () => {
    calendarRef.current.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current.getApi().next();
  };

  const handleDatesSet = async (dateInfo) => {
    setCalendarTitle(dateInfo.view.title);

    const startDate = dateInfo.startStr.substring(0, 10);
    const endDate = dateInfo.endStr.substring(0, 10);

    try {
      const response = await fetch(
        `http://localhost:8080/api/schedules?start=${startDate}&end=${endDate}`
      );

      if (!response.ok) {
        throw new Error("Could not load schedules.");
      }

      const data = await response.json();

      const today = getTodayString();
      const doctorSchedules = {};

      data.forEach((schedule) => {
        if (
          currentUser &&
          currentUser.doctorId &&
          Number(schedule.doctorId) === Number(currentUser.doctorId) &&
          schedule.shiftDate >= today
        ) {
          doctorSchedules[schedule.shiftDate] = schedule.shiftType;
        }
      });

      setMySchedules(doctorSchedules);
    } catch (error) {
      console.error("Error loading schedules:", error);
      setMySchedules({});
    }
  };

  const renderDate = (info) => {
    const dateString = info.date.toISOString().substring(0, 10);
    const shiftType = mySchedules[dateString];

    const color = shiftType
      ? getColor(shiftType)
      : info.isToday
        ? "#facc15"
        : null;

    return (
      <div
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "2px",
          backgroundColor: color || "transparent",
          color: color ? "white" : "#263238",
          fontWeight: "bold",
          boxShadow: info.isToday
            ? "0 0 10px 3px rgba(250, 204, 21, 0.8)"
            : "none"
        }}
      >
        {info.dayNumberText}
      </div>
    );
  };

  return (
    <div className="calendar-page">
      <h1>Schedule View</h1>

      <div className="calendar-navigation">
        <button
          onClick={handlePrevious}
          className="calendar-arrow"
          type="button"
        >
          ←
        </button>

        <h2>{calendarTitle}</h2>

        <button
          onClick={handleNext}
          className="calendar-arrow"
          type="button"
        >
          →
        </button>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={false}
        showNonCurrentDates={false}
        fixedWeekCount={false}
        height="auto"
        datesSet={handleDatesSet}
        dayHeaderClass="my-day-header"
        dayCellTopContent={renderDate}
      />

      <div className="calendar-legend">
        <div className="calendar-legend-item">
          <span className="calendar-legend-color legend-early-morning"></span>
          Early Morning
        </div>

        <div className="calendar-legend-item">
          <span className="calendar-legend-color legend-eight-thirty"></span>
          8:30
        </div>

        <div className="calendar-legend-item">
          <span className="calendar-legend-color legend-late-doctor"></span>
          Late Doctor
        </div>

        <div className="calendar-legend-item">
          <span className="calendar-legend-color legend-surgery"></span>
          Surgery
        </div>

        <div className="calendar-legend-item">
          <span className="calendar-legend-color legend-overnight"></span>
          Overnight
        </div>

        <div className="calendar-legend-item">
          <span className="calendar-legend-color legend-sunday"></span>
          Sunday
        </div>
      </div>
    </div>
  );
}

export default Calendar;
