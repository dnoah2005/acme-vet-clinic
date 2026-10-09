
import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "./SchedulingCalendar.css";

const API_URL = "http://localhost:8080/api";

const VACATION_ALLOWANCE = 8;
const SICK_ALLOWANCE = 4;

const SHIFT_STARTS = {
  EARLY_MORNING: { hour: 7, minute: 30 },
  SURGERY: { hour: 7, minute: 30 },
  EIGHT_THIRTY: { hour: 8, minute: 30 },
  LATE_DOCTOR: { hour: 9, minute: 30 },
  OVERNIGHT: { hour: 20, minute: 0 },
  SUNDAY: { hour: 8, minute: 0 }
};

function SchedulingCalendar({ currentUser }) {
  const calendarRef = useRef(null);

  const [calendarTitle, setCalendarTitle] = useState("");
  const [mySchedules, setMySchedules] = useState({});
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [message, setMessage] = useState("");
  const [showDateMessage, setShowDateMessage] = useState(false);
  const [showShiftPicker, setShowShiftPicker] = useState(false);

  const [timeOffMode, setTimeOffMode] = useState("");
  const [timeOffMessage, setTimeOffMessage] = useState("");
  const [timeOffDateValid, setTimeOffDateValid] = useState(false);
  const [submittingTimeOff, setSubmittingTimeOff] = useState(false);

  const [vacationUsed, setVacationUsed] = useState(0);
  const [vacationRemaining, setVacationRemaining] =
    useState(VACATION_ALLOWANCE);
  const [sickUsed, setSickUsed] = useState(0);
  const [sickRemaining, setSickRemaining] = useState(SICK_ALLOWANCE);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const getDateString = useCallback((date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }, []);

  const getToday = useCallback(() => {
    return getDateString(new Date());
  }, [getDateString]);

  const getMinDate = useCallback(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 14);

    return getDateString(date);
  }, [getDateString]);

  const getShiftOptions = useCallback(() => {
    if (!selectedDate) {
      return [];
    }

    const day = new Date(`${selectedDate}T00:00:00`).getDay();

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
  }, [selectedDate]);

  const loadSchedules = useCallback(
    async (start, end) => {
      if (!currentUser?.doctorId) {
        setMySchedules({});
        return;
      }

      try {
        const startDate = start.substring(0, 10);
        const endDate = end.substring(0, 10);

        const response = await fetch(
          `${API_URL}/schedules?start=${startDate}&end=${endDate}`
        );

        if (!response.ok) {
          console.error(
            "Could not load schedules:",
            await response.text()
          );
          return;
        }

        const data = await response.json();
        const schedules = {};

        data.forEach((schedule) => {
          if (
            Number(schedule.doctorId) === Number(currentUser.doctorId) &&
            schedule.shiftDate >= getToday()
          ) {
            schedules[schedule.shiftDate] = schedule.shiftType;
          }
        });

        setMySchedules(schedules);
      } catch (error) {
        console.error("Could not load schedules:", error);
      }
    },
    [currentUser?.doctorId, getToday]
  );

  const loadTimeOffBalance = useCallback(async () => {
    if (!currentUser?.doctorId) {
      setVacationUsed(0);
      setVacationRemaining(VACATION_ALLOWANCE);
      setSickUsed(0);
      setSickRemaining(SICK_ALLOWANCE);
      return;
    }

    setLoadingBalance(true);

    try {
      const response = await fetch(
        `${API_URL}/doctors/${currentUser.doctorId}/time-off/balance`
      );

      if (!response.ok) {
        console.error(
          "Could not load time-off balance:",
          await response.text()
        );
        return;
      }

      const data = await response.json();

      setVacationUsed(Number(data.vacationUsed ?? 0));
      setVacationRemaining(Number(data.vacationRemaining ?? 0));
      setSickUsed(Number(data.sickUsed ?? 0));
      setSickRemaining(Number(data.sickRemaining ?? 0));
    } catch (error) {
      console.error("Could not load time-off balance:", error);
    } finally {
      setLoadingBalance(false);
    }
  }, [currentUser?.doctorId]);

  useEffect(() => {
    loadTimeOffBalance();
  }, [loadTimeOffBalance]);

  const handleDatesSet = (dateInfo) => {
    setCalendarTitle(dateInfo.view.title);
    loadSchedules(dateInfo.startStr, dateInfo.endStr);
  };

  const handlePrevious = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
  };

  const clearTimeOffSelection = () => {
    setSelectedDate("");
    setTimeOffMessage("");
    setTimeOffDateValid(false);
  };

  const startTimeOffMode = (type) => {
    if (!currentUser?.doctorId) {
      setTimeOffMessage(
        "Your doctor account could not be identified. Please log in again."
      );
      setTimeOffMode("");
      setTimeOffDateValid(false);
      return;
    }

    if (type === "VACATION" && vacationRemaining <= 0) {
      setTimeOffMode("");
      setSelectedDate("");
      setTimeOffDateValid(false);
      setTimeOffMessage("You don't have any more vacation time.");
      return;
    }

    if (type === "SICK" && sickRemaining <= 0) {
      setTimeOffMode("");
      setSelectedDate("");
      setTimeOffDateValid(false);
      setTimeOffMessage("You don't have any more sick days.");
      return;
    }

    setTimeOffMode(type);
    setSelectedDate("");
    setTimeOffDateValid(false);
    setTimeOffMessage(
      type === "VACATION"
        ? "Vacation mode is on. Select a date on the calendar."
        : "Sick-call mode is on. Select a date when you are scheduled to work."
    );

    setMessage("");
    setShowDateMessage(false);
    setShowShiftPicker(false);

    const calendarApi = calendarRef.current?.getApi();

    if (calendarApi) {
      const view = calendarApi.view;

      loadSchedules(
        view.activeStart.toISOString(),
        view.activeEnd.toISOString()
      );
    }
  };

  const validateTimeOffDate = (date, type) => {
    const now = new Date();
    const today = getToday();

    if (date < today) {
      return "You cannot request time off for a date that has already passed.";
    }

    if (type === "VACATION") {
      const currentYear = now.getFullYear();
      const selectedYear = Number(date.substring(0, 4));

      if (selectedYear !== currentYear) {
        return "Vacation can only be scheduled during the current calendar year.";
      }

      if (date < getMinDate()) {
        return "Vacation must be requested at least 2 weeks in advance.";
      }

      return "";
    }

    if (type !== "SICK") {
      return "Select vacation or sick time before choosing a date.";
    }

    const shiftType = mySchedules[date];

    if (!shiftType) {
      return "You must have a scheduled shift on this date to call in sick. Make sure the shift is loaded on the calendar.";
    }

    const shiftStartTime = SHIFT_STARTS[shiftType];

    if (!shiftStartTime) {
      return "The scheduled shift has an unknown start time.";
    }

    const shiftStart = new Date(`${date}T00:00:00`);

    shiftStart.setHours(
      shiftStartTime.hour,
      shiftStartTime.minute,
      0,
      0
    );

    const minutesUntilShift =
      (shiftStart.getTime() - now.getTime()) / 60000;

    if (minutesUntilShift < 10) {
      return "Sick time must be called in at least 10 minutes before your shift.";
    }

    if (minutesUntilShift > 24 * 60) {
      return "Sick time can only be called in within 24 hours of your shift.";
    }

    return "";
  };

  const handleTimeOffDateClick = (clickedDate) => {
    setSelectedDate(clickedDate);
    setTimeOffDateValid(false);

    const validationError = validateTimeOffDate(
      clickedDate,
      timeOffMode
    );

    if (validationError) {
      setTimeOffMessage(validationError);
      return;
    }

    setTimeOffDateValid(true);
    setTimeOffMessage(
      timeOffMode === "VACATION"
        ? `You selected ${clickedDate} for vacation. Confirm below to submit your request.`
        : `You selected your scheduled shift on ${clickedDate} for sick time. Confirm below to call in sick.`
    );
  };

  const handleDateClick = (info) => {
    const clickedDate = info.dateStr;

    if (timeOffMode) {
      handleTimeOffDateClick(clickedDate);
      return;
    }

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
      setMessage("You are already scheduled to work on this date.");
      setShowDateMessage(true);
      return;
    }

    setSelectedDate(clickedDate);
    setShowShiftPicker(true);
  };

  const getVisibleCalendarRange = () => {
    const calendarApi = calendarRef.current?.getApi();

    if (!calendarApi) {
      return null;
    }

    return {
      start: calendarApi.view.activeStart.toISOString(),
      end: calendarApi.view.activeEnd.toISOString()
    };
  };

  const refreshVisibleSchedules = async () => {
    const range = getVisibleCalendarRange();

    if (range) {
      await loadSchedules(range.start, range.end);
    }
  };

  const handleRegister = async () => {
    setMessage("");

    if (!selectedDate) {
      setMessage("Please select a date.");
      return;
    }

    if (!selectedShift) {
      setMessage("Please select a shift.");
      return;
    }

    if (!currentUser?.doctorId) {
      setMessage("No doctor ID was found for this account.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/doctors/${currentUser.doctorId}/schedules`,
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
        setMessage(data || "Could not register the shift.");
        return;
      }

      setShowShiftPicker(false);
      setSelectedDate("");
      setSelectedShift("");
      setMessage("");

      await refreshVisibleSchedules();
    } catch (error) {
      console.error("Could not register shift:", error);
      setMessage("Could not connect to the backend.");
    }
  };

  const submitTimeOff = async () => {
    if (!selectedDate || !timeOffMode || !timeOffDateValid) {
      setTimeOffMessage("Select a valid date before confirming.");
      return;
    }

    if (!currentUser?.doctorId) {
      setTimeOffMessage("No doctor ID was found for this account.");
      return;
    }

    setSubmittingTimeOff(true);
    setTimeOffMessage("");

    try {
      const response = await fetch(
        `${API_URL}/doctors/${currentUser.doctorId}/time-off`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            requestDate: selectedDate,
            requestType: timeOffMode
          })
        }
      );

      const data = await response.text();

      if (!response.ok) {
        setTimeOffDateValid(false);
        setTimeOffMessage(
          data || "Could not submit the time-off request."
        );
        return;
      }

      const completedType = timeOffMode;
      const completedDate = selectedDate;

      setTimeOffMessage(
        data ||
          `${
            completedType === "VACATION" ? "Vacation" : "Sick time"
          } request submitted successfully.`
      );

      setTimeOffDateValid(false);
      setTimeOffMode("");
      setSelectedDate("");

      if (completedType === "SICK") {
        setMySchedules((previous) => {
          const updated = { ...previous };
          delete updated[completedDate];
          return updated;
        });
      }

      await Promise.all([
        loadTimeOffBalance(),
        refreshVisibleSchedules()
      ]);
    } catch (error) {
      console.error("Could not submit time-off request:", error);
      setTimeOffDateValid(false);
      setTimeOffMessage("Could not connect to the backend.");
    } finally {
      setSubmittingTimeOff(false);
    }
  };

  const cancelTimeOff = () => {
    setTimeOffMode("");
    clearTimeOffSelection();
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

  const shiftClassNames = (date) => {
    const shift = mySchedules[getDateString(date)];

    return shift ? [`scheduled-${shift.toLowerCase()}`] : [];
  };

  return (
    <div className="scheduling-calendar-page">
      <header className="scheduling-page-header">
        <span className="scheduling-eyebrow">DOCTOR PORTAL</span>
        <h1>Scheduling</h1>
        <p>Manage your work shifts, vacation, and sick time.</p>
      </header>

      <section
        className="time-off-balance"
        aria-label="Time-off balances"
      >
        <article className="time-off-balance-card vacation-card">
          <div className="balance-card-heading">
            <span className="balance-icon" aria-hidden="true">
              ☀
            </span>
            <div>
              <h2>Vacation Time</h2>
              <p>Plan time away in advance</p>
            </div>
          </div>

          <div className="balance-number-row">
            <strong>{vacationRemaining}</strong>
            <span>days remaining</span>
          </div>

          <div className="balance-progress-track">
            <div
              className="balance-progress vacation-progress"
              style={{
                width: `${Math.min(
                  100,
                  (vacationUsed / VACATION_ALLOWANCE) * 100
                )}%`
              }}
            />
          </div>

          <p className="balance-usage">
            {loadingBalance
              ? "Refreshing balance…"
              : `${vacationUsed} of ${VACATION_ALLOWANCE} days used`}
          </p>

          <button
            type="button"
            className="time-off-button vacation-button"
            onClick={() => startTimeOffMode("VACATION")}
            disabled={loadingBalance || vacationRemaining <= 0}
          >
            Request Vacation
          </button>
        </article>

        <article className="time-off-balance-card sick-card">
          <div className="balance-card-heading">
            <span className="balance-icon" aria-hidden="true">
              ✚
            </span>
            <div>
              <h2>Sick Time</h2>
              <p>Call in for a scheduled shift</p>
            </div>
          </div>

          <div className="balance-number-row">
            <strong>{sickRemaining}</strong>
            <span>days remaining</span>
          </div>

          <div className="balance-progress-track">
            <div
              className="balance-progress sick-progress"
              style={{
                width: `${Math.min(
                  100,
                  (sickUsed / SICK_ALLOWANCE) * 100
                )}%`
              }}
            />
          </div>

          <p className="balance-usage">
            {loadingBalance
              ? "Refreshing balance…"
              : `${sickUsed} of ${SICK_ALLOWANCE} days used`}
          </p>

          <button
            type="button"
            className="time-off-button sick-button"
            onClick={() => startTimeOffMode("SICK")}
            disabled={loadingBalance || sickRemaining <= 0}
          >
            Call In Sick
          </button>
        </article>
      </section>

      {timeOffMode && (
        <section className="time-off-mode-panel">
          <div>
            <strong>
              {timeOffMode === "VACATION"
                ? "Vacation selection"
                : "Sick-time selection"}
            </strong>
            <p>
              {timeOffMode === "VACATION"
                ? "Choose a date at least 14 days from today, within this calendar year."
                : "Choose a scheduled shift within the next 24 hours. Requests must be at least 10 minutes before the shift."}
            </p>
          </div>

          <button
            type="button"
            className="cancel-mode-button"
            onClick={cancelTimeOff}
          >
            Cancel
          </button>
        </section>
      )}

      {timeOffMessage && (
        <section
          className={`time-off-result ${
            timeOffDateValid ? "time-off-result-valid" : ""
          }`}
          aria-live="polite"
        >
          <div>
            <strong>
              {timeOffDateValid
                ? "Confirm your selection"
                : timeOffMode
                  ? "Time-off selection"
                  : "Time-off result"}
            </strong>
            <p>{timeOffMessage}</p>
          </div>

          {timeOffDateValid && timeOffMode && (
            <button
              type="button"
              className="confirm-time-off-button"
              onClick={submitTimeOff}
              disabled={submittingTimeOff}
            >
              {submittingTimeOff
                ? "Submitting…"
                : "Confirm Request"}
            </button>
          )}

          {!timeOffMode && (
            <button
              type="button"
              className="dismiss-result-button"
              onClick={() => setTimeOffMessage("")}
            >
              Dismiss
            </button>
          )}
        </section>
      )}

      {!timeOffMode && (
        <div className="scheduling-instructions">
          <strong>Register a work shift</strong>
          <p>
            Select a date on the calendar to register your work
            schedule. Shifts must be registered at least 2 weeks ahead.
          </p>
        </div>
      )}

      <section className="calendar-panel">
        <div className="scheduling-calendar-navigation">
          <button
            onClick={handlePrevious}
            className="scheduling-calendar-arrow"
            type="button"
            aria-label="Previous month"
          >
            ←
          </button>

          <h2>{calendarTitle}</h2>

          <button
            onClick={handleNext}
            className="scheduling-calendar-arrow"
            type="button"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        {timeOffMode && (
          <p className="calendar-mode-hint">
            Select a calendar date to continue your{" "}
            {timeOffMode === "VACATION"
              ? "vacation request"
              : "sick-time request"}.
          </p>
        )}

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
          dayHeaderClassNames={["scheduling-day-header"]}
          dayCellClassNames={(info) => [
            "scheduling-calendar-cell",
            ...(info.isToday ? ["scheduling-calendar-today"] : []),
            ...shiftClassNames(info.date),
            ...(timeOffMode ? ["time-off-selectable"] : []),
            ...(selectedDate === getDateString(info.date)
              ? ["selected-time-off-date"]
              : [])
          ]}
        />
      </section>

      {showDateMessage && (
        <div className="schedule-modal-overlay">
          <div
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduling-notice-title"
          >
            <h2 id="scheduling-notice-title">Scheduling Notice</h2>
            <p>{message}</p>

            <button
              onClick={closeDateMessage}
              type="button"
              className="modal-primary-button"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showShiftPicker && (
        <div className="schedule-modal-overlay">
          <div
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-picker-title"
          >
            <h2 id="shift-picker-title">Select Your Shift</h2>
            <p>
              Selected date: <strong>{selectedDate}</strong>
            </p>

            <select
              className="shift-select"
              value={selectedShift}
              onChange={(event) => setSelectedShift(event.target.value)}
            >
              <option value="">Select a shift</option>

              {getShiftOptions().map((shift) => (
                <option key={shift.value} value={shift.value}>
                  {shift.label}
                </option>
              ))}
            </select>

            {message && (
              <p className="schedule-error" role="alert">
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
