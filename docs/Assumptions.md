# Project Assumptions

- The clinic operates in the `America/Los_Angeles` time zone. Shift times,
	request dates, and calendar boundaries use that local time zone.
- A scheduling week runs Monday through Sunday. Overnight shifts are assigned
	to the local date on which the shift starts and end the following morning.
- The baseline schedule has five doctor shifts per day Monday-Saturday
	(including surgery) and two Sunday shifts. The eight additional doctor
	positions are assigned to Saturday Early, Friday Late, and one additional
	Early position each Monday-Saturday.
- Each doctor averages four shifts each week (40 weekly doctor positions for
	ten doctors); each technician averages four shifts (80 weekly technician
	positions for twenty technicians). Four shifts is a balancing target, not a
	hard per-person cap.
- The stated eight vacation days and four sick days are counted as inclusive
	calendar days in each calendar year, including days when the employee was
	not otherwise scheduled to work.
- A vacation request is evaluated using its start date and must start at least
	21 days after submission. Sick leave is one future calendar day and cannot
	start today.
- Doctors and technicians may request only vacation or sick time. The
	administrator is the only role that creates or edits shift assignments.
- Technicians are assigned to the same shift as the doctors they support.
	Required technician counts are set per shift; technician allocation is
	balanced across the active technician roster.
- Deactivating an employee prevents future automatic assignments but retains
	their historical account and related database records.
- Login sessions are held in backend memory and are cleared when the backend
	process restarts.
- The Admin should be the one rescheduling emplyees instead of the employees rescheaduling themselves.
