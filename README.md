# ACME Vet Clinic Scheduler

React/Vite frontend with a Java Spring Boot and PostgreSQL backend. The
backend uses JDBC prepared statements directly; it does not use Spring Data
JPA or `JdbcTemplate`.

## Run locally

1. Configure PostgreSQL connection values in
   `backend/src/main/resources/application-local.properties` (or supply the
   equivalent Spring datasource environment variables).
2. Start the backend from `backend`:

   ```powershell
   .\mvnw.cmd spring-boot:run
   ```

3. Start the frontend from `frontend`:

   ```powershell
   npm install
   npm run dev
   ```

4. Open the address shown by Vite (normally `http://localhost:5173`). The
   initial administrator login is `admin` / `admin`; it must be changed on the
   first login.

## Initial scheduling setup

Using the administrator dashboard, create the clinic roster (normally 10
doctors and 20 technicians). In **Schedules**, choose **Generate current +
next week**. Staff can then sign in and view their assigned two-week schedule.

Project documentation is in `docs/`, including the user manual, assumptions,
ER diagram, schema, and team log template.
