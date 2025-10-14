package com.example.usersbe.services;

import org.springframework.stereotype.Service;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.exceptions.*;
import com.example.usersbe.model.User;

import jakarta.mail.MessagingException;

import java.time.LocalDateTime;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class UserService {

    private final UserDao userDao;
    private final EmailService emailService;

private static final Pattern EMAIL_VALIDO =
    Pattern.compile("^[\\p{L}0-9._%+-]+@[\\p{L}0-9.-]+\\.[A-Za-z]{2,}$");


    public UserService(UserDao userDao, EmailService emailService) {
        this.userDao = userDao;
        this.emailService = emailService;
    }

    public void registrar(String nombre, String apellidos, String alias, String email,
                          String fechaNac, String pwd, boolean vip, String foto,
                          User.Role role) {

        final String emailN = (email == null) ? "" : email.trim().toLowerCase();
        if (this.userDao.findByEmail(emailN) != null) {
            throw new UserAlreadyExistsException(emailN);
        }

        String pwdEncriptada = org.mindrot.jbcrypt.BCrypt.hashpw(pwd, org.mindrot.jbcrypt.BCrypt.gensalt());

        User user = new User();
        user.setNombre(nombre);
        user.setApellidos(apellidos);
        user.setAlias(alias);
        user.setEmail(emailN);
        user.setFechaNac(java.time.LocalDate.parse(fechaNac));
        user.setPwd(pwdEncriptada);
        user.setVip(vip);
        user.setFoto((foto == null || foto.isBlank()) ? "/static/fotos/image.png" : foto);
        user.setRole(role);

        this.userDao.save(user);
    }

    public void sendPasswordRecoveryEmail(String email) {

        if (email == null || email.isBlank() || !EMAIL_VALIDO.matcher(email).matches()) {
            throw new InvalidEmailException("Dirección de correo inválida: " + email);
        }

        User user = userDao.findByEmail(email);
        if (user == null) return;

        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        user.setResetPasswordToken(token);
        user.setResetPasswordExpires(LocalDateTime.now().plusHours(1));
        userDao.save(user);

        String link = "http://localhost:4200/auth/reset-password?token=" + token;

        String body = """
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Recuperación de contraseña - EsiMedia</title>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f7f8fa; color: #333; padding: 20px; }
                    .container { background-color: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 25px; max-width: 600px; margin: auto; }
                    .button { background-color: #007bff; color: white; text-decoration: none; padding: 10px 18px; border-radius: 5px; display: inline-block; margin-top: 15px; }
                    .footer { margin-top: 20px; font-size: 0.9em; color: #666; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                     <img src="cid:logoEsiMedia" alt="EsiMedia Logo" style="width:100px; margin-bottom:10px;">
                    <h2>🔐 Recuperación de contraseña</h2>
                    <p>Hola, <strong>%s</strong>,</p>
                    <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>EsiMedia</strong>.</p>
                    <p>Si realizaste esta solicitud, haz clic en el siguiente botón:</p>
                    <p><a href="%s" class="button" style="color: black; text-decoration: none;">Restablecer contraseña</a></p>
                    <p>Este enlace caducará en <strong>1 hora</strong>.</p>
                    <p>Si no solicitaste este cambio, ignora este mensaje.</p>
                    <p>Atentamente,<br><strong>El equipo de EsiMedia 🎬</strong></p>
                    <div class="footer">© 2025 EsiMedia - Todos los derechos reservados.</div>
                </div>
            </body>
        </html>
        """.formatted(user.getNombre(), link);

        try {
            emailService.sendMail(user.getEmail(), "Recuperación de contraseña - EsiMedia", body);
        } catch (MessagingException e) {
            throw new EmailSendException("Error enviando correo de recuperación", e);
        }

    }

    public void resetPassword(String token, String newPassword) {

        if (token == null || token.trim().isEmpty()) {
            throw new InvalidTokenException("Token no proporcionado");
        }

        User user = userDao.findByResetPasswordToken(token.trim());

        if (user == null || user.getResetPasswordExpires() == null) {
            throw new InvalidTokenException("Token inválido o caducado. Solicita uno nuevo.");
        }

        if (user.getResetPasswordExpires().isBefore(LocalDateTime.now())) {
            throw new ExpiredTokenException("Token caducado. Solicita uno nuevo.");
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw new InvalidPasswordException("La nueva contraseña debe tener al menos 8 caracteres");
        }

        if (org.mindrot.jbcrypt.BCrypt.checkpw(newPassword, user.getPwd())) {
            throw new InvalidPasswordException("La nueva contraseña no puede ser igual a la anterior");
        }

        String hashed = org.mindrot.jbcrypt.BCrypt.hashpw(newPassword, org.mindrot.jbcrypt.BCrypt.gensalt());
        user.setPwd(hashed);

        user.setResetPasswordToken(null);
        user.setResetPasswordExpires(null);
        userDao.save(user);
    }

    
    public List<User> listarUsuarios() {
        return userDao.findAll();
    }
}
