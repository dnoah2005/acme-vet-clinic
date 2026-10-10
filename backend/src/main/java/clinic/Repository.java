package clinic;

import org.springframework.jdbc.datasource.DataSourceUtils;
import javax.sql.DataSource;
import java.sql.*;
import java.time.*;
import java.util.*;

@org.springframework.stereotype.Repository
class Repository {
    private final DataSource db;

    Repository(DataSource db) {
        this.db = db;
    }

    private interface Binder {
        void bind(PreparedStatement s) throws SQLException;
    }

    private interface Mapper<T> {
        T map(ResultSet r) throws SQLException;
    }

    private User user(ResultSet r) throws SQLException {
        return new User(
                r.getLong("uid"), 
                r.getString("username"), 
                r.getString("full_name"),
                Role.valueOf(r.getString("role")), 
                r.getBoolean("active"), 
                r.getBoolean("must_change_password"));
    }

    private Shift shift(ResultSet r) throws SQLException {
        return new Shift(
                r.getLong("sid"), 
                r.getObject("start_at", OffsetDateTime.class),
                r.getObject("end_at", OffsetDateTime.class), 
                ShiftType.valueOf(r.getString("shift_type")),
                r.getInt("required_doctors"), 
                r.getInt("required_technicians"));
    }

    @SuppressWarnings("null")
    private <T> List<T> query(String sql, Binder b, Mapper<T> m) {
        Connection c = DataSourceUtils.getConnection(db);
        try (PreparedStatement s = c.prepareStatement(sql)) {
            b.bind(s);
            try (ResultSet r = s.executeQuery()) {
                List<T> out = new ArrayList<>();
                while (r.next())
                    out.add(m.map(r));
                return out;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Database operation failed", e);
        } finally {
            DataSourceUtils.releaseConnection(c, db);
        }
    }

    private void update(String sql, Binder b) {
        @SuppressWarnings("null")
        Connection c = DataSourceUtils.getConnection(db);
        try (PreparedStatement s = c.prepareStatement(sql)) {
            b.bind(s);
            s.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Database operation failed", e);
        } finally {
            DataSourceUtils.releaseConnection(c, db);
        }
    }

    private long returningId(String sql, Binder b) {
        return query(sql, b, r -> r.getLong(1)).getFirst();
    }

    Optional<User> user(long id) {
        return query("select * from app_user where uid=?", s -> s.setLong(1, id), this::user).stream().findFirst();
    }

    Optional<User> user(String username) {
        return query("select * from app_user where username=?", s -> s.setString(1, username), this::user).stream()
                .findFirst();
    }

    String passwordHash(String username) {
        return query("select password_hash from app_user where username=?", s -> s.setString(1, username),
                r -> r.getString(1)).getFirst();
    }

    List<User> staff(Role role) {
        return query("select * from app_user where active=true and role=? order by uid",
                s -> s.setString(1, role.name()), this::user);
    }

    List<User> users() {
        return query("select * from app_user order by role,full_name", s -> {
        }, this::user);
    }

    long createUser(NewUser u, String hash) {
        return returningId(
                "insert into app_user(username,password_hash,full_name,role,must_change_password) values(?,?,?,?,true) returning uid",
                s -> {
                    s.setString(1, u.username());
                    s.setString(2, hash);
                    s.setString(3, u.fullName());
                    s.setString(4, u.role().name());
                });
    }

    void deactivate(long id) {
        update("update app_user set active=false where uid=?", s -> s.setLong(1, id));
    }

    void password(long id, String hash, boolean mustChange) {
        update("update app_user set password_hash=?,must_change_password=? where uid=?", s -> {
            s.setString(1, hash);
            s.setBoolean(2, mustChange);
            s.setLong(3, id);
        });
    }

    void seedAdmin(String hash) {
        update("insert into app_user(username,password_hash,full_name,role,must_change_password) values('admin',?,'System Administrator','ADMIN',true) on conflict(username) do nothing",
                s -> s.setString(1, hash));
    }

    List<Shift> shifts(LocalDate start, LocalDate end) {
        return query("select * from schedule_shift where start_at >= ? and start_at < ? order by start_at,shift_type",
                s -> {
                    s.setObject(1, start.atStartOfDay().atOffset(ZoneOffset.UTC));
                    s.setObject(2, end.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC));
                }, this::shift);
    }

    long addShift(OffsetDateTime start, OffsetDateTime end, ShiftType t, int docs, int techs) {
        return returningId(
                "insert into schedule_shift(start_at,end_at,shift_type,required_doctors,required_technicians) values(?,?,?,?,?) returning sid",
                s -> {
                    s.setObject(1, start);
                    s.setObject(2, end);
                    s.setString(3, t.name());
                    s.setInt(4, docs);
                    s.setInt(5, techs);
                });
    }

    void deleteWeek(LocalDate monday) {
        update("delete from schedule_shift where start_at >= ? and start_at < ?", s -> {
            s.setObject(1, monday.atStartOfDay().atOffset(ZoneOffset.UTC));
            s.setObject(2, monday.plusDays(7).atStartOfDay().atOffset(ZoneOffset.UTC));
        });
    }

    void assign(long shift, long user) {
        update("insert into shift_assignment(sid, uid) values(?,?)", s -> {
            s.setLong(1, shift);
            s.setLong(2, user);
        });
    }

    List<Assignment> assignments(LocalDate start, LocalDate end) {
        return query(
                "select a.sid,a.uid from shift_assignment a join schedule_shift s on s.uid=a.sid where s.start_at>=? and s.start_at<?",
                s -> {
                    s.setObject(1, start.atStartOfDay().atOffset(ZoneOffset.UTC));
                    s.setObject(2, end.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC));
                }, r -> new Assignment(r.getLong(1), r.getLong(2)));
    }

    List<Shift> scheduleFor(long user, LocalDate start, LocalDate end) {
        return query(
                "select s.* from schedule_shift s join shift_assignment a on a.sid=s.uid where a.uid=? and s.start_at>=? and s.start_at<? order by s.start_at",
                s -> {
                    s.setLong(1, user);
                    s.setObject(2, start.atStartOfDay().atOffset(ZoneOffset.UTC));
                    s.setObject(3, end.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC));
                }, this::shift);
    }

    List<User> coworkers(long shiftId) {
        return query(
                "select u.* from app_user u join shift_assignment a on a.uid=u.uid where a.sid=? order by u.role,u.full_name",
                s -> s.setLong(1, shiftId), this::user);
    }

    boolean timeOff(long user, LocalDate date) {
        return query(
                "select exists(select 1 from time_off_request where uid=? and status='APPROVED' and ? between start_date and end_date)",
                s -> {
                    s.setLong(1, user);
                    s.setObject(2, date);
                }, r -> r.getBoolean(1)).getFirst();
    }

    int leaveDays(long user, LeaveType type, int year) {
        return query(
                "select coalesce(sum((least(end_date,make_date(?,12,31))-greatest(start_date,make_date(?,1,1)))+1),0) from time_off_request where uid=? and leave_type=? and status='APPROVED' and start_date<=make_date(?,12,31) and end_date>=make_date(?,1,1)",
                s -> {
                    s.setInt(1, year);
                    s.setInt(2, year);
                    s.setLong(3, user);
                    s.setString(4, type.name());
                    s.setInt(5, year);
                    s.setInt(6, year);
                }, r -> r.getInt(1)).getFirst();
    }

    long addRequest(long user, TimeOffInput x, boolean ok, String reason) {
        return returningId(
                "insert into time_off_request(uid,leave_type,start_date,end_date,status,reason) values(?,?,?,?,?,?) returning tid",
                s -> {
                    s.setLong(1, user);
                    s.setString(2, x.leaveType().name());
                    s.setObject(3, x.startDate());
                    s.setObject(4, x.endDate());
                    s.setString(5, ok ? "APPROVED" : "DENIED");
                    s.setString(6, reason);
                });
    }

    void deleteRequest(long id) {
        update("delete from time_off_request where tid=?", s -> s.setLong(1, id));
    }
}
