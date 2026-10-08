
import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";

import "./SchedulingCalendar.css";

function SchedulingCalendar({ currentUser }) {
  const calendarRef = useRef(null);

  const [calendarTitle, setCalendarTitle] = useState("");
  const [mySchedules, setMySchedules] = useState({});
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [message, setMessage] = useState("");
  const [showDateMessage, setShowDateMessage] = useState(false);
  const [showShiftPicker, setShowShiftPicker] = useState(false);

  const getDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getToday = () => {
    return getDateString(new Date());
  };

  const getMinDate = () => {
    const date = new Date();

    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 14);

    return getDateString(date);
  };

  const getShiftOptions = () => {
    if (!selectedDate) {
      return [];
    }

    const date = new Date(selectedDate + "T00:00:00");
    const day = date.getDay();

    if (day === 0) {
      return [
        {
          value: "SUNDAY",
          label: "Sunday Shift — 8:00 AM - 8:00 PM"
        },
        {
          value: "OVERNIGHT",
          label: "Overnight — 8:00 PM - 8:00 AM"
        }
      ];
    }

    return [
      {
        value: "EARLY_MORNING",
        label: "Early Morning — 7:30 AM - 6:30 PM"
      },
      {
        value: "EIGHT_THIRTY",
        label: "8:30 Shift — 8:30 AM - 7:30 PM"
      },
      {
        value: "LATE_DOCTOR",
        label: "Late Doctor — 9:30 AM - 8:30 PM"
      },
      {
        value: "SURGERY",
        label: "Surgery — 7:30 AM - 6:30 PM"
      },
      {
        value: "OVERNIGHT",
        label: "Overnight — 8:00 PM - 8:00 AM"
      }
    ];
  };

  const loadSchedules = async (start, end) => {
    try {
      const startDate = start.substring(0, 10);
      const endDate = end.substring(0, 10);

      const response = await fetch(
        `http://localhost:8080/api/schedules?start=${startDate}&end=${endDate}`
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const schedules = {};

      data.forEach((schedule) => {
        if (
          currentUser &&
          Number(schedule.doctorId) === Number(currentUser.doctorId) &&
          schedule.shiftDate >= getToday()
        ) {
          schedules[schedule.shiftDate] = schedule.shiftType;
        }
      });

      setMySchedules(schedules);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDatesSet = (dateInfo) => {
    setCalendarTitle(dateInfo.view.title);

    loadSchedules(
      dateInfo.startStr,
      dateInfo.endStr
    );
  };

  const handlePrevious = () => {
    calendarRef.current.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current.getApi().next();
  };

  const handleDateClick = (info) => {
    const clickedDate = info.dateStr;
    const today = getToday();
    const minimumDate = getMinDate();

    setMessage("");
    setSelectedShift("");

    if (clickedDate < today) {
      setSelectedDate(clickedDate);

      setMessage(
        "You cannot schedule a shift on a date that has already passed."
      );

      setShowDateMessage(true);
      return;
    }

    if (clickedDate < minimumDate) {
      setSelectedDate(clickedDate);

      setMessage(
        "Schedules must be registered at least 2 weeks ahead."
      );

      setShowDateMessage(true);
      return;
    }

    if (mySchedules[clickedDate]) {
      setSelectedDate(clickedDate);

      setMessage(
        "You are already scheduled to work on this date."
      );

      setShowDateMessage(true);
      return;
    }

    setSelectedDate(clickedDate);
    setShowShiftPicker(true);
  };

  const handleRegister = async () => {
    setMessage("");

    if (!selectedShift) {
      setMessage("Please select a shift.");
      return;
    }

    if (!currentUser) {
      setMessage("No logged-in user was found.");
      return;
    }

    if (!currentUser.doctorId) {
      setMessage(
        "No doctor ID was found for this account."
      );
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8080/api/doctors/${currentUser.doctorId}/schedules`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            shiftDate: selectedDate,
            shiftType: selectedShift
          })
        }
      );

      const data = await response.text();

      if (!response.ok) {
        setMessage(data);
        return;
      }

      setMySchedules((previous) => ({
        ...previous,
        [selectedDate]: selectedShift
      }));

      setShowShiftPicker(false);
      setSelectedDate("");
      setSelectedShift("");
      setMessage("");
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not connect to the backend."
      );
    }
  };

  const closeDateMessage = () => {
    setShowDateMessage(false);
    setSelectedDate("");
    setMessage("");
  };

  const closeShiftPicker = () => {
    setShowShiftPicker(false);
    setSelectedDate("");
    setSelectedShift("");
    setMessage("");
  };

  return (
    <div className="scheduling-calendar-page">

      <h1>Scheduling</h1>

      <p className="scheduling-instructions">
        Select a date on the calendar to register your work schedule.
      </p>

      <p className="scheduling-instructions">
        Dates must be at least 2 weeks in advance.
      </p>

      <div className="scheduling-calendar-navigation">

        <button
          onClick={handlePrevious}
          className="scheduling-calendar-arrow"
          type="button"
        >
          ←
        </button>

        <h2>{calendarTitle}</h2>

        <button
          onClick={handleNext}
          className="scheduling-calendar-arrow"
          type="button"
        >
          →
        </button>

      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={false}
        showNonCurrentDates={false}
        fixedWeekCount={false}
        height="auto"
        datesSet={handleDatesSet}
        dateClick={handleDateClick}
        dayHeaderClass="scheduling-day-header"
        dayCellClass={(info) => {
          const date = getDateString(info.date);
          const shift = mySchedules[date];

          let classes = "scheduling-calendar-cell";

          if (info.isToday) {
            classes += " scheduling-calendar-today";
          }

          if (shift) {
            classes += ` scheduled-${shift.toLowerCase()}`;
          }

          return classes;
        }}
      />

      {showDateMessage && (
        <div className="schedule-modal-overlay">
          <div className="schedule-modal">

            <h2>Scheduling Notice</h2>

            <p>{message}</p>

            <button
              onClick={closeDateMessage}
              type="button"
            >
              OK
            </button>

          </div>
        </div>
      )}

      {showShiftPicker && (
        <div className="schedule-modal-overlay">

          <div className="schedule-modal">

            <h2>Select Your Shift</h2>

            <p>
              Selected date:
              <strong> {selectedDate}</strong>
            </p>

            <select
              className="shift-select"
              value={selectedShift}
              onChange={(event) =>
                setSelectedShift(event.target.value)
              }
            >

              <option
                value=""
                className="shift-option"
              >
                Select a shift
              </option>

              {getShiftOptions().map((shift) => (
                <option
                  key={shift.value}
                  value={shift.value}
                  className="shift-option"
                >
                  {shift.label}
                </option>
              ))}

            </select>

            {message && (
              <p className="schedule-error">
                {message}
              </p>
            )}

            <div className="schedule-modal-buttons">

              <button
                onClick={handleRegister}
                className="modal-primary-button"
                type="button"
              >
                Register Shift
              </button>

              <button
                onClick={closeShiftPicker}
                className="modal-secondary-button"
                type="button"
              >
                Cancel
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default SchedulingCalendar;
