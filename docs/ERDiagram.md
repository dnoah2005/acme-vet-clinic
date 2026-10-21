# Entity Relationship Diagram

```mermaid
erDiagram
    APP_USER ||--o{ SHIFT_ASSIGNMENT : receives
    SCHEDULE_SHIFT ||--o{ SHIFT_ASSIGNMENT : contains
    APP_USER ||--o{ TIME_OFF_REQUEST : submits

    APP_USER {
        int uid PK
        string username UK
        string password_hash
        string full_name
        string role
        boolean active
        boolean must_change_password
        timestamptz created_at
    }

    SCHEDULE_SHIFT {
        int sid PK
        timestamptz start_at
        timestamptz end_at
        string shift_type
        int required_doctors
        int required_technicians
    }

    SHIFT_ASSIGNMENT {
        int said PK
        int sid FK
        int uid FK
    }

    TIME_OFF_REQUEST {
        int tid PK
        int uid FK
        string leave_type
        date start_date
        date end_date
        string status
        string reason
        timestamptz submitted_at
    }

```

The corresponding PostgreSQL table definitions and constraints are maintained in
[`../backend/src/main/resources/schema.sql`](../backend/src/main/resources/schema.sql).
