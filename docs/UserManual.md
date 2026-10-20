# ACME Vet Clinic Scheduler User Manual

## Login

Open the application and sign in with the username and password provided by
the clinic administrator. The initial administrator account is:

- Username: `admin`
- Temporary password: `admin`

The administrator must choose a new password before using other parts of the
system. The backend invalidates all sessions when it restarts, so sign in again
after a backend restart.

## Doctor and Technician Schedule

After signing in, open **Schedule View** to see the next two weeks of assigned
shifts. Use the previous/next controls to move by two weeks. Select a date or
shift to review coworkers assigned to the same shift. Surgery shifts are shown
with their own shift type and color.

Open **Scheduling** to submit time-off or work-shift requests. Vacation
requests must begin at least three weeks after submission and are limited to
eight calendar days per calendar year. A sick-day request must be for one day
after today and is limited to four calendar days per calendar year. The
remaining balance is shown with the request controls. A work-shift request
must be for a future date; only doctors may request surgery shifts.

The system responds immediately with approval or a reason for denial. An
approved request causes the affected schedule week or weeks to be regenerated.
Approved requests are treated as commitments during regeneration.

Use **Log Out** when finished. Sessions are tied to a server-issued token;
changing the user ID in browser storage does not grant access to another
account.

## Administrator

The administrator dashboard provides employee account management, password
reset, and shift assignment controls. Only an administrator can create or
deactivate doctor and technician accounts, reset employee passwords, and
manually assign or unassign staff. Employees cannot create an administrator
account.

Create the clinic roster before generating a schedule: the normal roster is
10 active doctors and 20 active technicians. Then open **Schedules** and use
**Generate current + next week**. The operation builds complete schedules for
the current Monday–Sunday week and the following week, while honoring approved
time-off and work-shift requests. If there are not enough eligible active
employees, it reports that no complete schedule can be created and leaves the
existing schedule unchanged.

## Schedule Rules

The scheduler creates one doctor for each regular shift, one surgeon for each
Monday-Saturday surgery shift, and the specified extra doctor positions. It
assigns one technician to each overnight, two to the Sunday day shift, and
technicians to the other shifts based on their staffing requirements. It
balances weekly assignment counts, enforces a ten-hour break, and prevents a
doctor from receiving two surgery shifts or two overnight shifts in the same
week.
