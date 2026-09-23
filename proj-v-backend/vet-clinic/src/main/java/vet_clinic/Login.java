package vet_clinic;

import jakarta.persistence.*;

@Entity
@Table(name = "login")
public class Login {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer lid;

    @Column(name = "lname", nullable = false)
    private String lname;

    @Column(name = "lusername", unique = true, nullable = false)
    private String lusername;

    @Column(name = "lemail", unique = true, nullable = false)
    private String lemail;

    @Column(name = "lpassword", nullable = false)
    private String lpassword;

    @Column(name = "role", nullable = false)
    private String role;

    public Integer getLid() {
        return lid;
    }

    public String getLname() {
        return lname;
    }

    public void setLname(String lname) {
        this.lname = lname;
    }

    public String getLusername() {
        return lusername;
    }

    public void setLusername(String lusername) {
        this.lusername = lusername;
    }

    public String getLemail() {
        return lemail;
    }

    public void setLemail(String lemail) {
        this.lemail = lemail;
    }

    public String getLpassword() {
        return lpassword;
    }

    public void setLpassword(String lpassword) {
        this.lpassword = lpassword;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}