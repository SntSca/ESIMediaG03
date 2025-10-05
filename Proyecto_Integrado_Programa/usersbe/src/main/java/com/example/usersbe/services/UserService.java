package com.example.usersbe.services;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.model.User;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class UserService {

    @Autowired
    private UserDao userDao;

    @Autowired
    private EmailService emailService;

    public void registrar(String nombre, String apellidos, String alias, String email, 
                          String fechaNac, String pwd, boolean vip, String foto,
                          User.Role role) throws Exception {

        if (this.userDao.findByEmail(email) != null) {
            throw new Exception("El usuario ya existe");
        }

        String pwdEncriptada = org.mindrot.jbcrypt.BCrypt.hashpw(pwd, org.mindrot.jbcrypt.BCrypt.gensalt());

        User user = new User();
        user.setNombre(nombre);
        user.setApellidos(apellidos);
        user.setAlias(alias);
        user.setEmail(email);
        user.setFechaNac(java.time.LocalDate.parse(fechaNac));
        user.setPwd(pwdEncriptada);
        user.setVip(vip);
        user.setFoto(foto);
        user.setRole(role);
        this.userDao.save(user);
    }

     public void enviarTokenRecuperacion(String email) {
        User user = userDao.findByEmail(email);
        if (user == null) return; // no revelar si existe o no

        String token = UUID.randomUUID().toString();
        user.setResetPasswordToken(token);
        user.setResetPasswordExpires(LocalDateTime.now().plusHours(1));
        userDao.save(user);

        String link = "http://localhost:4200/reset-password?token=" + token;
        String cuerpo = "Hola " + user.getNombre() + ",\n\n" +
                        "Haz clic en este enlace para restablecer tu contraseña:\n" +
                        link + "\n\nEste enlace caduca en 1 hora.";
        emailService.sendMail(email, "Recuperar contraseña", cuerpo);
    }

    public boolean cambiarPasswordConToken(String token, String nuevaPwd) {
        User user = userDao.findByResetPasswordToken(token);
        if (user == null || user.getResetPasswordExpires().isBefore(LocalDateTime.now())) {
            return false;
        }

        String hashed = org.mindrot.jbcrypt.BCrypt.hashpw(nuevaPwd, org.mindrot.jbcrypt.BCrypt.gensalt());
        user.setPwd(hashed);
        user.setResetPasswordToken(null);
        user.setResetPasswordExpires(null);
        userDao.save(user);
        return true;
    }

 
}

