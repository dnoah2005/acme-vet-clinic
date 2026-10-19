
import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import "../styles/SchedulingCalendar.css";

const API_URL = "http://localhost:8080/api";
const VACATION_ALLOWANCE = 8;
const SICK_ALLOWANCE = 4;
const CLINIC_TIME_ZONE = "America/Los_Angeles";

const SHIFT_INFO = {
  EARLY: { label: "Early Morning", color: "#16a34a" },
  EIGHT_THIRTY: { label: "8:30 Shift", color: "#2563eb" },
  LATE: { label: "Late Doctor", color: "#ea580c" },
  SURGERY: { label: "Surgery", color: "#dc2626" },
  OVERNIGHT: { label: "Overnight", color: "#7c3aed" },
  SUNDAY: { label: "Sunday Shift", color: "#0891b2" },
};

async function readResponse(response) {
  const text = await response.text();
  let data = {};

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
  const [mySchedules, setMySchedules] = useState({});
  const [selectedDate, setSelectedDate] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedShiftInfo, setSelectedShiftInfo] = useState(null);

  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  const [timeOffMode, setTimeOffMode] = useState("");
  const [selectedShiftType, setSelectedShiftType] = useState("EARLY");
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
    }),
    [userId]
  );

  const loadSchedules = useCallback(
    async (from, to) => {
      if (!userId) {
        setMySchedules({});
        setScheduleError(
          "Your login session does not include a user ID. Please log in again."
        );
        return;
      }

      setLoadingSchedules(true);
      setScheduleError("");

      try {
        const params = new URLSearchParams({ from, to });

        const response = await fetch(
          `${API_URL}/users/${encodeURIComponent(
            userId
          )}/schedule?${params}`,
          {
            headers: requestHeaders(),
          }
        );

        const data = await readResponse(response);

        if (!Array.isArray(data)) {
          throw new Error(
            "The schedule endpoint returned an unexpected response."
          );
        }

        const nextSchedules = {};

        data.forEach((row) => {
          const shift = row.shift;

          if (!shift?.startAt || !shift?.endAt) return;

          const shiftType = String(
            shift.shiftType || ""
          ).toUpperCase();

          const info = SHIFT_INFO[shiftType] || {
            label: shiftType.replaceAll("_", " ") || "Shift",
            color: "#555555",
          };

          const shiftDate = clinicDateString(shift.startAt);

          const coworkers = (row.coworkers || [])
            .map((person) => person.fullName || person.username)
            .filter(Boolean);

          const schedule = {
            id: shift.id,
            date: shiftDate,
            shiftType,
            label: info.label,
            color: info.color,
            startAt: shift.startAt,
            endAt: shift.endAt,
            coworkers,
          };

          if (!nextSchedules[shiftDate]) {
            nextSchedules[shiftDate] = [];
          }

          // Keep assignments for conflict checking, but do not
          // add them as events to the Scheduling calendar.
          nextSchedules[shiftDate].push(schedule);
        });

        setMySchedules(nextSchedules);
      } catch (error) {
        console.error("Could not load schedules:", error);

        setScheduleError(
          error.message || "Could not load your schedule."
        );

        setMySchedules({});
      } finally {
        setLoadingSchedules(false);
      }
    },
    [requestHeaders, userId]
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

  const refreshVisibleSchedules = useCallback(async () => {
    const api = calendarRef.current?.getApi();

    if (!api) return;

    const from = clinicDateString(api.view.activeStart);
    const to = addDays(clinicDateString(api.view.activeEnd), -1);

    await loadSchedules(from, to);
  }, [loadSchedules]);

  useEffect(() => {
    loadTimeOffBalance();
  }, [loadTimeOffBalance]);

  const handleDatesSet = useCallback(
    (dateInfo) => {
      setCalendarTitle(dateInfo.view.title);

      const from = dateInfo.startStr.slice(0, 10);
      const to = addDays(dateInfo.endStr.slice(0, 10), -1);

      loadSchedules(from, to);
    },
    [loadSchedules]
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
    setSelectedShiftType("EARLY");
    setTimeOffDateValid(false);
    setSelectedShiftInfo(null);

    setTimeOffMessage(
      type === "VACATION"
        ? "Select the first and last vacation dates on the calendar. Requests must be submitted at least 3 weeks ahead."
        : type === "SICK"
          ? "Select any future date for a one-day sick-time request. Same-day requests are not allowed."
          : "Select a future work date, choose the shift type, and submit your request. The scheduler will grant or deny it immediately."
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

    if (type === "WORK") {
      if (start !== end) {
        return "Work-shift requests must be for one date at a time.";
      }

      if (start <= today) {
        return "Work-shift requests must be for a future date.";
      }

      if ((mySchedules[start] || []).length > 0) {
        return "You already have a shift assigned on this date. Choose another date.";
      }

      if (!selectedShiftType) {
        return "Choose the shift type you want to work.";
      }

      return "";
    }

    return "Select a request type first.";
  };

  const handleDateClick = (info) => {
    const clickedDate = info.dateStr;

    setSelectedShiftInfo(null);

    if (!timeOffMode) {
      setSelectedDate(clickedDate);

      setSelectedShiftInfo({
        date: clickedDate,
        shifts: mySchedules[clickedDate] || [],
      });

      return;
    }

    if (timeOffMode === "WORK") {
      setRangeStart(clickedDate);
      setRangeEnd(clickedDate);
      setSelectedDate(clickedDate);

      const existingShifts = mySchedules[clickedDate] || [];

      if (existingShifts.length > 0) {
        setTimeOffDateValid(false);
        setTimeOffMessage(
          `You already have ${existingShifts
            .map((shift) => shift.label)
            .join(", ")} assigned on ${clickedDate}. Choose a different date.`
        );
        return;
      }

      if (clickedDate <= today) {
        setTimeOffDateValid(false);
        setTimeOffMessage(
          "Work-shift requests must be for a future date."
        );
        return;
      }

      const isSunday =
        new Date(`${clickedDate}T12:00:00`).getDay() === 0;

      const availableTypes = isSunday
        ? ["SUNDAY", "OVERNIGHT"]
        : [
            "EARLY",
            "SURGERY",
            "EIGHT_THIRTY",
            "LATE",
            "OVERNIGHT",
          ];

      const preferredType =
        availableTypes.includes(selectedShiftType) &&
        (
          selectedShiftType !== "SURGERY" ||
          currentUser?.role === "DOCTOR"
        )
          ? selectedShiftType
          : isSunday
            ? "SUNDAY"
            : "EARLY";

      setSelectedShiftType(preferredType);
      setTimeOffDateValid(true);

      setTimeOffMessage(
        `Request ${
          SHIFT_INFO[preferredType]?.label || preferredType
        } on ${clickedDate}? Confirm to submit.`
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
      const isWorkRequest = timeOffMode === "WORK";

      const url = isWorkRequest
        ? `${API_URL}/users/${encodeURIComponent(
            userId
          )}/work-shift-requests`
        : `${API_URL}/users/${encodeURIComponent(
            userId
          )}/time-off`;

      const body = isWorkRequest
        ? {
            workDate: rangeStart,
            shiftType: selectedShiftType,
          }
        : {
            leaveType: timeOffMode,
            startDate: rangeStart,
            endDate: rangeEnd,
          };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...requestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await readResponse(response);

      if (data.granted === false) {
        setTimeOffDateValid(false);
        setTimeOffMessage(data.reason || "The request was denied.");
        return;
      }

      setTimeOffMessage(
        data.reason ||
          (isWorkRequest
            ? "Your work-shift request was approved."
            : "Your time-off request was approved.")
      );

      setTimeOffMode("");
      clearTimeOffSelection();

      if (isWorkRequest) {
        await refreshVisibleSchedules();
      } else {
        await Promise.all([
          loadTimeOffBalance(),
          refreshVisibleSchedules(),
        ]);
      }
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
    setSelectedShiftType("EARLY");
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
          View available dates, request work shifts, and manage
          vacation or sick time.
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
                : timeOffMode === "SICK"
                  ? "Sick-time selection"
                  : "Work-shift selection"}
            </strong>

            <p>
              {timeOffMode === "VACATION"
                ? "Click a start date, then click an end date. The first day must be at least 21 days away."
                : timeOffMode === "SICK"
                  ? "Click any future date. Sick-time requests cover one day and cannot be for today."
                  : "Click a future date. Dates with an assigned shift cannot be requested again."}
            </p>

            {timeOffMode === "WORK" && (
              <label className="work-shift-type-label">
                Preferred shift

                <select
                  className="work-shift-type-select"
                  value={selectedShiftType}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedShiftType(value);

                    if (!rangeStart || !rangeEnd) {
                      setTimeOffDateValid(false);
                      setTimeOffMessage(
                        "Select a future date on the calendar, then confirm your request."
                      );
                      return;
                    }

                    const validationError = validateTimeOffRange(
                      rangeStart,
                      rangeEnd,
                      "WORK"
                    );

                    setTimeOffDateValid(!validationError);
                    setTimeOffMessage(
                      validationError ||
                        `Request ${
                          SHIFT_INFO[value]?.label || value
                        } on ${rangeStart}? Confirm to submit. The scheduler checks staffing and rest requirements.`
                    );
                  }}
                >
                  {(
                    rangeStart &&
                    new Date(`${rangeStart}T12:00:00`).getDay() === 0
                      ? ["SUNDAY", "OVERNIGHT"]
                      : [
                          "EARLY",
                          "SURGERY",
                          "EIGHT_THIRTY",
                          "LATE",
                          "OVERNIGHT",
                        ]
                  )
                    .filter(
                      (type) =>
                        type !== "SURGERY" ||
                        currentUser?.role === "DOCTOR"
                    )
                    .map((type) => (
                      <option key={type} value={type}>
                        {SHIFT_INFO[type].label}
                      </option>
                    ))}
                </select>
              </label>
            )}
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
                : timeOffMode === "WORK"
                  ? "Work-shift request"
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
          <strong>Request shifts and time off</strong>

          <p>
            This calendar is for selecting request dates. Your
            assigned shifts are shown in the Schedule View tab.
            Dates where you already have a shift cannot be used
            for another work-shift request.
          </p>

          <button
            type="button"
            className="time-off-button work-request-button"
            onClick={() => startTimeOffMode("WORK")}
          >
            Request Work Shift
          </button>
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
              : timeOffMode === "SICK"
                ? "sick-time request"
                : "work-shift request"}
            .
          </p>
        )}

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={false}
          showNonCurrentDates={true}
          fixedWeekCount={false}
          height="auto"
          datesSet={handleDatesSet}
          dateClick={handleDateClick}
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
