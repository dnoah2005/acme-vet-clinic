
import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";

import "../styles/SchedulingCalendar.css";

function SchedulingCalendar() {
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
    <div className="scheduling-calendar-page">
      <h1>Scheduling</h1>

      <div className="scheduling-calendar-navigation">
        <button
          onClick={handlePrevious}
          className="scheduling-calendar-arrow"
        >
          ←
        </button>

        <h2>{calendarTitle}</h2>

        <button
          onClick={handleNext}
          className="scheduling-calendar-arrow"
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
        dayHeaderClass="scheduling-day-header"
        dayCellClass={(state) =>
          state.isToday
            ? "scheduling-calendar-cell scheduling-calendar-today"
            : "scheduling-calendar-cell"
        }
        dayCellTopInnerClass={(state) =>
          state.isToday
            ? "scheduling-day-number scheduling-day-number-today"
            : "scheduling-day-number"
        }
      />
    </div>
  );
}

export default SchedulingCalendar;