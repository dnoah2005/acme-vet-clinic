    CREATE TABLE IF NOT EXISTS app_user (
    uid INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY, 
    username VARCHAR(50) UNIQUE NOT NULL, 
    password_hash VARCHAR(100) NOT NULL,
    full_name VARCHAR(120) NOT NULL, 
    role VARCHAR(15) NOT NULL CHECK (role IN ('ADMIN','DOCTOR','TECHNICIAN')),
    active BOOLEAN NOT NULL DEFAULT TRUE, 
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS schedule_shift (
    sid INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY, 
    start_at TIMESTAMPTZ NOT NULL, 
    end_at TIMESTAMPTZ NOT NULL,
    shift_type VARCHAR(20) NOT NULL CHECK (shift_type IN ('EARLY','EIGHT_THIRTY','LATE','SUNDAY','OVERNIGHT','SURGERY')),
    required_doctors INT NOT NULL, 
    required_technicians INT NOT NULL, UNIQUE(start_at, shift_type), CHECK (end_at > start_at)
    );

    CREATE TABLE IF NOT EXISTS shift_assignment (
    said INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY, 
    sid INTEGER NOT NULL REFERENCES schedule_shift(sid) ON DELETE CASCADE,
    uid INTEGER NOT NULL REFERENCES app_user(uid), 
    UNIQUE(sid, uid)
    );

    CREATE TABLE IF NOT EXISTS time_off_request (
    tid INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY, 
    uid INTEGER NOT NULL REFERENCES app_user(uid),
    leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('VACATION','SICK')),
    start_date DATE NOT NULL, 
    end_date DATE NOT NULL, status VARCHAR(10) NOT NULL CHECK (status IN ('APPROVED','DENIED')),
    reason TEXT, submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(end_date >= start_date)
    );

    CREATE INDEX IF NOT EXISTS assignment_user_idx ON shift_assignment(uid);
    CREATE INDEX IF NOT EXISTS shift_start_idx ON schedule_shift(start_at);
    CREATE INDEX IF NOT EXISTS request_user_date_idx ON time_off_request(uid,start_date,end_date);
