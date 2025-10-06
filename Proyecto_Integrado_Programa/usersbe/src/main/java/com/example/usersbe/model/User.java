package com.example.usersbe.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "users")
public class User {
    public enum Role {
        USUARIO, GESTOR_CONTENIDO, ADMINISTRADOR
    }

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String nombre;
    private String apellidos;
    private String alias;
    private LocalDate fechaNac;
    private String pwd; 
    private boolean vip;
    private LocalDate fechaVip;
    private String foto; 

    private Role role = Role.USUARIO;

    @Transient
    private String confirmarPwd;

    private String resetPasswordToken;
    private LocalDateTime resetPasswordExpires;

    public User() {
        this.id = UUID.randomUUID().toString();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getApellidos() { return apellidos; }
    public void setApellidos(String apellidos) { this.apellidos = apellidos; }

    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }

    public LocalDate getFechaNac() { return fechaNac; }
    public void setFechaNac(LocalDate fechaNac) { this.fechaNac = fechaNac; }

    public String getPwd() { return pwd; }
    public void setPwd(String pwd) { this.pwd = pwd; }

    public boolean isVip() { return vip; }

    public void setVip(boolean vip) { this.vip = vip; 
        if (vip && this.fechaVip == null) {
            this.fechaVip = LocalDate.now();
        } else if (!vip) {
            this.fechaVip = null;
        }
    }

    public LocalDate getFechaVip() { return fechaVip; }
    public void setFechaVip(LocalDate fechaVip) { this.fechaVip = fechaVip;}

    public String getFoto() { return foto; }
    public void setFoto(String foto) { this.foto = foto; }

    public String getConfirmarPwd() { return confirmarPwd; }
    public void setConfirmarPwd(String confirmarPwd) { this.confirmarPwd = confirmarPwd; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public String getResetPasswordToken() { return resetPasswordToken; }
    public void setResetPasswordToken(String resetPasswordToken) { this.resetPasswordToken = resetPasswordToken; }

    public LocalDateTime getResetPasswordExpires() { return resetPasswordExpires; }
    public void setResetPasswordExpires(LocalDateTime resetPasswordExpires) { this.resetPasswordExpires = resetPasswordExpires; }

}
