import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";

import "../styles/Calendar.css";

function Calendar() {
  const calendarRef = useRef(null);
  const [calendarTitle, setCalendarTitle] = useState("");

  const handlePrevious = () => {
    calendarRef.current.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current.getApi().next();
  };

  const handleDatesSet = (dateInfo) => {
    setCalendarTitle(dateInfo.view.title);
  };

  return (
    <div className="calendar-page">
      <h1>Schedule View</h1>

      <div className="calendar-navigation">
        <button
          onClick={handlePrevious}
          className="calendar-arrow"
        >
          ←
        </button>

        <h2>{calendarTitle}</h2>

        <button
          onClick={handleNext}
          className="calendar-arrow"
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

        dayCellClass={(state) =>
          state.isToday
            ? "my-calendar-cell my-calendar-today"
            : "my-calendar-cell"
        }

        dayCellTopInnerClass={(state) =>
          state.isToday
            ? "my-day-number my-day-number-today"
            : "my-day-number"
        }
      />
    </div>
  );
}

export default Calendar;