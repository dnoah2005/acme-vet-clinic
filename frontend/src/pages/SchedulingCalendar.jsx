
import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import "../styles/SchedulingCalendar.css";

const API_URL = "http://localhost:8080/api";
const VACATION_ALLOWANCE = 8;
const SICK_ALLOWANCE = 4;
const CLINIC_TIME_ZONE = "America/Los_Angeles";

async function readResponse(response) {
  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    console.error("API request failed:", {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      body: text,
    });

    throw new Error(
      data.error ||
        data.message ||
        `Server error: HTTP ${response.status} ${response.statusText}`
    );
  }

  return data;
}

function clinicDateString(value) {
  const date = value instanceof Date ? value : new Date(value);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type) =>
    parts.find((item) => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatTime(value) {
  if (!value) return "Time unavailable";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function SchedulingCalendar({ currentUser }) {
  const calendarRef = useRef(null);

  const [calendarTitle, setCalendarTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  // Retained as inactive placeholders while old schedule-panel markup is
  // removed in a future visual cleanup.
  const [selectedShiftInfo, setSelectedShiftInfo] = useState(null);
  const [loadingSchedules] = useState(false);
  const [scheduleError] = useState("");

  const [timeOffMode, setTimeOffMode] = useState("");
  const [timeOffMessage, setTimeOffMessage] = useState("");
  const [timeOffDateValid, setTimeOffDateValid] = useState(false);
  const [submittingTimeOff, setSubmittingTimeOff] = useState(false);

  const [vacationUsed, setVacationUsed] = useState(0);
  const [sickUsed, setSickUsed] = useState(0);
  const [vacationRemaining, setVacationRemaining] =
    useState(VACATION_ALLOWANCE);
  const [sickRemaining, setSickRemaining] =
    useState(SICK_ALLOWANCE);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const userId =
    currentUser?.id ?? currentUser?.uid ?? currentUser?.userId;

  const today = clinicDateString(new Date());

  const requestHeaders = useCallback(
    () => ({
      "X-User-Id": String(userId),
      "X-Auth-Token": currentUser?.authToken ?? "",
    }),
    [currentUser?.authToken, userId]
  );

  const loadTimeOffBalance = useCallback(async () => {
    if (!userId) return;

    setLoadingBalance(true);

    try {
      const year = new Date().getFullYear();
      const params = new URLSearchParams({
        year: String(year),
      });

      const response = await fetch(
        `${API_URL}/users/${encodeURIComponent(
          userId
        )}/leave-balance?${params}`,
        {
          headers: requestHeaders(),
        }
      );

      const data = await readResponse(response);

      setVacationUsed(
        Math.max(0, Number(data.vacationUsed ?? 0))
      );

      setSickUsed(
        Math.max(0, Number(data.sickUsed ?? 0))
      );

      setVacationRemaining(
        Math.max(
          0,
          Number(data.vacationRemaining ?? VACATION_ALLOWANCE)
        )
      );

      setSickRemaining(
        Math.max(
          0,
          Number(data.sickRemaining ?? SICK_ALLOWANCE)
        )
      );
    } catch (error) {
      console.error("Could not load leave balance:", error);

      setTimeOffMessage(
        error.message || "Could not load leave balance."
      );
    } finally {
      setLoadingBalance(false);
    }
  }, [requestHeaders, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTimeOffBalance();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadTimeOffBalance]);

  const handleDatesSet = useCallback(
    (dateInfo) => {
      setCalendarTitle(dateInfo.view.title);
    },
    []
  );

  const getVacationMinDate = () => addDays(today, 21);

  const clearTimeOffSelection = () => {
    setSelectedDate("");
    setRangeStart("");
    setRangeEnd("");
    setTimeOffDateValid(false);
  };

  const startTimeOffMode = (type) => {
    if (!userId) {
      setTimeOffMessage(
        "Your account could not be identified. Please log in again."
      );
      return;
    }

    if (type === "VACATION" && vacationRemaining <= 0) {
      setTimeOffMessage(
        "You do not have any vacation days remaining this year."
      );
      return;
    }

    if (type === "SICK" && sickRemaining <= 0) {
      setTimeOffMessage(
        "You do not have any sick days remaining this year."
      );
      return;
    }

    setTimeOffMode(type);
    setSelectedDate("");
    setRangeStart("");
    setRangeEnd("");
    setTimeOffDateValid(false);

    setTimeOffMessage(
      type === "VACATION"
        ? "Select the first and last vacation dates on the calendar. Requests must be submitted at least 3 weeks ahead."
        : type === "SICK"
          ? "Select any future date for a one-day sick-time request. Same-day requests are not allowed."
          : ""
    );
  };

  const validateTimeOffRange = (start, end, type) => {
    if (!start || !end) {
      return "Select a start date and an end date.";
    }

    if (end < start) {
      return "The end date cannot be before the start date.";
    }

    if (start < today) {
      return "Time off cannot start on a date that has already passed.";
    }

    if (type === "VACATION") {
      if (start < getVacationMinDate()) {
        return "Vacation requests must be submitted at least 3 weeks before the first day.";
      }

      return "";
    }

    if (type === "SICK") {
      if (start !== end) {
        return "Sick-time requests must cover one day at a time.";
      }

      if (start <= today) {
        return "A sick-day request cannot be for today or a past date.";
      }

      return "";
    }

    return "Select a request type first.";
  };

  const handleDateClick = (info) => {
    const clickedDate = info.dateStr;

    if (!timeOffMode) {
      setSelectedDate(clickedDate);
      setTimeOffMessage(
        "Choose Vacation or Sick Time to make a time-off request."
      );
      return;
    }

    if (timeOffMode === "SICK") {
      setRangeStart(clickedDate);
      setRangeEnd(clickedDate);
      setSelectedDate(clickedDate);

      const validationError = validateTimeOffRange(
        clickedDate,
        clickedDate,
        timeOffMode
      );

      setTimeOffDateValid(!validationError);

      setTimeOffMessage(
        validationError ||
          `Request sick time for ${clickedDate}? Confirm below to submit.`
      );

      return;
    }

    if (!rangeStart || rangeEnd) {
      setRangeStart(clickedDate);
      setRangeEnd("");
      setSelectedDate(clickedDate);
      setTimeOffDateValid(false);

      const validationError = validateTimeOffRange(
        clickedDate,
        clickedDate,
        timeOffMode
      );

      setTimeOffMessage(
        validationError ||
          `Start date selected: ${clickedDate}. Now select the last vacation date.`
      );

      return;
    }

    const start =
      clickedDate < rangeStart ? clickedDate : rangeStart;

    const end =
      clickedDate < rangeStart ? rangeStart : clickedDate;

    setRangeStart(start);
    setRangeEnd(end);
    setSelectedDate(start);

    const validationError = validateTimeOffRange(
      start,
      end,
      timeOffMode
    );

    setTimeOffDateValid(!validationError);

    setTimeOffMessage(
      validationError ||
        `Request vacation from ${start} through ${end}? Confirm below to submit.`
    );
  };

  const submitTimeOff = async () => {
    if (
      !timeOffMode ||
      !rangeStart ||
      !rangeEnd ||
      !timeOffDateValid
    ) {
      setTimeOffMessage(
        "Select a valid date or date range before confirming."
      );
      return;
    }

    if (!userId) {
      setTimeOffMessage(
        "Your account could not be identified. Please log in again."
      );
      return;
    }

    const validationError = validateTimeOffRange(
      rangeStart,
      rangeEnd,
      timeOffMode
    );

    if (validationError) {
      setTimeOffDateValid(false);
      setTimeOffMessage(validationError);
      return;
    }

    setSubmittingTimeOff(true);
    setTimeOffMessage("");

    try {
      const response = await fetch(`${API_URL}/users/${encodeURIComponent(
        userId
      )}/time-off`, {
        method: "POST",
        headers: {
          ...requestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leaveType: timeOffMode,
          startDate: rangeStart,
          endDate: rangeEnd,
        }),
      });

      const data = await readResponse(response);

      if (data.granted === false) {
        setTimeOffDateValid(false);
        setTimeOffMessage(data.reason || "The request was denied.");
        return;
      }

      setTimeOffMessage(
        data.reason || "Your time-off request was approved."
      );

      setTimeOffMode("");
      clearTimeOffSelection();

      await loadTimeOffBalance();
    } catch (error) {
      console.error("Could not submit request:", error);

      setTimeOffDateValid(false);
      setTimeOffMessage(
        error.message ||
          "Could not connect to the backend. Check that the server is running."
      );
    } finally {
      setSubmittingTimeOff(false);
    }
  };

  const cancelTimeOff = () => {
    setTimeOffMode("");
    setTimeOffMessage("");
    clearTimeOffSelection();
  };

  const handlePrevious = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
  };

  return (
    <div className="scheduling-calendar-page">
      <header className="scheduling-page-header">
        <span className="scheduling-eyebrow">
          {currentUser?.role === "TECHNICIAN"
            ? "TECHNICIAN PORTAL"
            : "DOCTOR PORTAL"}
        </span>

        <h1>Scheduling</h1>

        <p>
          Request vacation or sick time. Schedule assignments are
          managed by the clinic administrator.
        </p>
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
                )}%`,
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
              <p>Request one day off on any future date</p>
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
                )}%`,
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
            Request Sick Time
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
                ? "Click a start date, then click an end date. The first day must be at least 21 days away."
                : "Click any future date. Sick-time requests cover one day and cannot be for today."}
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
                ? "Confirm your request"
                : "Time-off request"}
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
          <strong>Request time off</strong>

          <p>
            Select Vacation or Sick Time, then click dates in the calendar.
            Your assigned shifts are shown in the Schedule View tab; only an
            administrator can create or edit the schedule.
          </p>
        </div>
      )}

      <section className="calendar-panel">
        <div className="scheduling-calendar-navigation">
          <button
            onClick={handlePrevious}
            className="scheduling-calendar-arrow"
            type="button"
            aria-label="Previous two weeks"
          >
            ←
          </button>

          <h2>{calendarTitle}</h2>

          <button
            onClick={handleNext}
            className="scheduling-calendar-arrow"
            type="button"
            aria-label="Next two weeks"
          >
            →
          </button>
        </div>

        {loadingSchedules && (
          <p className="calendar-status" role="status">
            Loading your schedule…
          </p>
        )}

        {scheduleError && (
          <p className="calendar-error" role="alert">
            {scheduleError}
          </p>
        )}

        {timeOffMode && (
          <p className="calendar-mode-hint">
            Select a date on the calendar to continue your{" "}
            {timeOffMode === "VACATION"
              ? "vacation request"
              : "sick-time request"}
            .
          </p>
        )}

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="twoWeek"
          views={{
            twoWeek: {
              type: "dayGrid",
              duration: { weeks: 2 },
            },
          }}
          headerToolbar={false}
          showNonCurrentDates={true}
          fixedWeekCount={false}
          height="auto"
          datesSet={handleDatesSet}
          dateClick={handleDateClick}
          dayCellClassNames={(cell) =>
            clinicDateString(cell.date) === selectedDate
              ? ["time-off-date-selected"]
              : []
          }
          events={[]}
        />
      </section>

      {selectedShiftInfo && !timeOffMode && (
        <section
          className="selected-date-panel"
          aria-live="polite"
        >
          <div className="selected-date-heading">
            <h2>{selectedShiftInfo.date}</h2>

            <button
              type="button"
              className="dismiss-result-button"
              onClick={() => setSelectedShiftInfo(null)}
            >
              Close
            </button>
          </div>

          {selectedShiftInfo.shifts.length === 0 ? (
            <p>
              No shift is assigned to you on this date. You cannot
              directly assign yourself a shift; assignments are
              managed by the clinic scheduler.
            </p>
          ) : (
            selectedShiftInfo.shifts.map((shift) => (
              <article
                className="selected-shift-card"
                key={shift.id}
              >
                <span
                  className="selected-shift-dot"
                  style={{ backgroundColor: shift.color }}
                />

                <div>
                  <strong>{shift.label}</strong>

                  <p>
                    {formatTime(shift.startAt)} –{" "}
                    {formatTime(shift.endAt)}
                  </p>

                  <p>
                    {shift.coworkers.length
                      ? `Coworkers: ${shift.coworkers.join(", ")}`
                      : "No additional coworkers listed."}
                  </p>
                </div>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}

export default SchedulingCalendar;
