
import { useCallback, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";

import "../styles/Calendar.css";

const API_URL = "http://localhost:8080/api";
const CLINIC_TIME_ZONE = "America/Los_Angeles";

const SHIFT_INFO = {
  EARLY: {
    label: "Early Morning",
    color: "#16a34a",
  },
  EIGHT_THIRTY: {
    label: "8:30 Shift",
    color: "#2563eb",
  },
  LATE: {
    label: "Late Doctor",
    color: "#ea580c",
  },
  SURGERY: {
    label: "Surgery",
    color: "#dc2626",
  },
  OVERNIGHT: {
    label: "Overnight",
    color: "#7c3aed",
  },
  SUNDAY: {
    label: "Sunday Shift",
    color: "#0891b2",
  },
};

function clinicDateString(value) {
  const date =
    value instanceof Date ? value : new Date(value);

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
  if (!value) {
    return "Time not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function Calendar({ currentUser }) {
  const calendarRef = useRef(null);

  const [calendarTitle, setCalendarTitle] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadedDates, setLoadedDates] = useState({});

  const handlePrevious = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
  };

  const handleDatesSet = useCallback(
    async (dateInfo) => {
      setCalendarTitle(dateInfo.view.title);

      if (!currentUser?.id) {
        setEvents([]);
        setLoadedDates({});
        setErrorMessage(
          "Your login session does not include a user ID. Please log in again."
        );
        return;
      }

      const from = dateInfo.startStr.slice(0, 10);

      // FullCalendar's end date is exclusive.
      // The backend schedule endpoint accepts an inclusive end date.
      const endExclusive = new Date(
        `${dateInfo.endStr.slice(0, 10)}T12:00:00`
      );

      endExclusive.setDate(endExclusive.getDate() - 1);

      const to = [
        endExclusive.getFullYear(),
        String(endExclusive.getMonth() + 1).padStart(2, "0"),
        String(endExclusive.getDate()).padStart(2, "0"),
      ].join("-");

      setLoading(true);
      setErrorMessage("");

      try {
        const params = new URLSearchParams({
          from,
          to,
        });

        const response = await fetch(
          `${API_URL}/users/${encodeURIComponent(
            currentUser.id
          )}/schedule?${params}`,
          {
            headers: {
              "X-User-Id": String(currentUser.id),
              "X-Auth-Token": currentUser.authToken,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Could not load your schedule."
          );
        }

        const nextEvents = [];
        const nextDates = {};

        data.forEach((row) => {
          const shift = row.shift;

          if (!shift?.startAt || !shift?.endAt) {
            return;
          }

          const shiftType = String(
            shift.shiftType || ""
          ).toUpperCase();

          const info = SHIFT_INFO[shiftType] || {
            label:
              shiftType.replaceAll("_", " ") || "Shift",
            color: "#555555",
          };

          const date = clinicDateString(shift.startAt);

          const coworkers = (row.coworkers || [])
            .map(
              (person) =>
                person.fullName || person.username
            )
            .filter(Boolean);

          nextDates[date] = {
            shiftType,
            color: info.color,
          };

          nextEvents.push({
            id: String(
              shift.id ??
                `${shift.startAt}-${shiftType}`
            ),
            title: info.label,
            start: shift.startAt,
            end: shift.endAt,
            allDay: false,
            backgroundColor: info.color,
            borderColor: info.color,
            extendedProps: {
              coworkers,
              startLabel: formatTime(shift.startAt),
              endLabel: formatTime(shift.endAt),
              shiftDate: date,
            },
          });
        });

        setEvents(nextEvents);
        setLoadedDates(nextDates);
      } catch (error) {
        console.error(
          "Error loading doctor schedule:",
          error
        );

        setEvents([]);
        setLoadedDates({});

        setErrorMessage(
          error.message || "Could not load your schedule."
        );
      } finally {
        setLoading(false);
      }
    },
    [currentUser]
  );

  const renderDate = (info) => {
    const dateString = clinicDateString(info.date);
    const shift = loadedDates[dateString];

    const backgroundColor =
      shift?.color ||
      (info.isToday ? "#facc15" : "transparent");

    const hasColor = Boolean(shift) || info.isToday;

    const textColor =
      info.isToday && !shift
        ? "#263238"
        : hasColor
          ? "white"
          : "#263238";

    return (
      <div
        className={`my-calendar-date${
          info.isToday ? " my-calendar-date-today" : ""
        }`}
      >
        <span
          className="my-calendar-date-number"
          style={{
            backgroundColor,
            color: textColor,
          }}
        >
          {info.dayNumberText}
        </span>
      </div>
    );
  };

  const renderEventContent = (eventInfo) => {
    const coworkers =
      eventInfo.event.extendedProps.coworkers || [];

    return (
      <div
        className="doctor-calendar-event"
        title={
          coworkers.length
            ? `Coworkers: ${coworkers.join(", ")}`
            : eventInfo.event.title
        }
      >
        <strong>{eventInfo.event.title}</strong>

        <span>
          {eventInfo.event.extendedProps.startLabel}
          {"–"}
          {eventInfo.event.extendedProps.endLabel}
        </span>

        {coworkers.length > 0 && (
          <small>
            With: {coworkers.join(", ")}
          </small>
        )}
      </div>
    );
  };

  return (
    <div className="calendar-page">
      <h1>Schedule View</h1>

      <p className="calendar-intro">
        Your assigned shifts and the coworkers scheduled
        with you.
      </p>

      <div className="calendar-navigation">
        <button
          onClick={handlePrevious}
          className="calendar-arrow"
          type="button"
          aria-label="Previous two weeks"
        >
          ←
        </button>

        <h2>{calendarTitle}</h2>

        <button
          onClick={handleNext}
          className="calendar-arrow"
          type="button"
          aria-label="Next two weeks"
        >
          →
        </button>
      </div>

      {loading && (
        <p className="calendar-status" role="status">
          Loading your schedule…
        </p>
      )}

      {errorMessage && (
        <p className="calendar-error" role="alert">
          {errorMessage}
        </p>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin]}
        initialView="twoWeek"
        views={{
          twoWeek: {
            type: "dayGrid",
            duration: { weeks: 2 },
          },
        }}
        headerToolbar={false}
        showNonCurrentDates={false}
        fixedWeekCount={false}
        height="auto"
        datesSet={handleDatesSet}
        events={events}
        eventContent={renderEventContent}
        dayHeaderClass="my-day-header"
        dayCellClass={(state) =>
          state.isToday
            ? "my-calendar-cell my-calendar-today"
            : "my-calendar-cell"
        }
        dayCellTopContent={renderDate}
      />

      <div
        className="calendar-legend"
        aria-label="Shift type legend"
      >
        {Object.entries(SHIFT_INFO).map(
          ([type, info]) => (
            <div
              className="calendar-legend-item"
              key={type}
            >
              <span
                className="calendar-legend-color"
                style={{
                  backgroundColor: info.color,
                }}
              />

              {info.label}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Calendar;
