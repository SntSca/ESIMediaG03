package com.example.usersbe.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.model.User;

import jakarta.mail.MessagingException;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private static final Pattern EMAIL_VALIDO =
            Pattern.compile("^[\\p{L}\\p{M}0-9._%+\\-]+@[\\p{L}\\p{M}0-9.\\-]+\\.[A-Za-z]{2,}$");

    private static final int TOKEN_BYTES = 32;

    private final UserDao userDao;
    private final EmailService emailService;

    public UserService(UserDao userDao, EmailService emailService) {
        this.userDao = Objects.requireNonNull(userDao);
        this.emailService = Objects.requireNonNull(emailService);
    }

    @Transactional
    public void registrar(String nombre, String apellidos, String alias, String email,
                          String fechaNac, String pwd, boolean vip, String foto,
                          User.Role role) {
        final String emailN = Optional.ofNullable(email).map(String::trim).map(String::toLowerCase).orElse("");
        if (!EMAIL_VALIDO.matcher(emailN).matches()) {
            throw new IllegalArgumentException("Dirección de correo inválida: " + email);
        }
        if (this.userDao.findByEmail(emailN) != null) {
            throw new IllegalStateException("El usuario ya existe");
        }
        if (pwd == null || pwd.length() < 8) {
            throw new IllegalArgumentException("La contraseña debe tener al menos 8 caracteres");
        }
        final LocalDate fnac;
        try {
            fnac = LocalDate.parse(fechaNac);
        } catch (Exception e) {
            throw new IllegalArgumentException("Fecha de nacimiento inválida (usa ISO-8601: yyyy-MM-dd)");
        }
        String pwdEncriptada = org.mindrot.jbcrypt.BCrypt.hashpw(pwd, org.mindrot.jbcrypt.BCrypt.gensalt());
        User user = new User();
        user.setNombre(nombre);
        user.setApellidos(apellidos);
        user.setAlias(alias);
        user.setEmail(emailN);
        user.setFechaNac(fnac);
        user.setPwd(pwdEncriptada);
        user.setVip(vip);
        user.setFoto(foto);
        user.setRole(role);

        this.userDao.save(user);
        log.info("[AUDITORÍA] Usuario registrado: {}", emailN);
    }

    @Transactional
    public void sendPasswordRecoveryEmail(String email) {
        if (email == null || email.isBlank() || !EMAIL_VALIDO.matcher(email).matches()) {
            throw new IllegalArgumentException("Dirección de correo inválida: " + email);
        }

        final String emailN = email.trim().toLowerCase();
        User user = userDao.findByEmail(emailN);
        if (user == null) {
            log.debug("Solicitud de recuperación para email no registrado: {}", emailN);
            return;
        }

        String token = generarTokenSeguro();
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
        """.formatted(Optional.ofNullable(user.getNombre()).orElse("usuario"), link);

        try {
            emailService.sendMail(user.getEmail(), "Recuperación de contraseña - EsiMedia", body);
            log.info("[AUDITORÍA] Email de recuperación enviado a: {}", emailN);
        } catch (MessagingException ex) {
            log.error("Error enviando email de recuperación a {}: {}", emailN, ex.getMessage(), ex);
            throw new IllegalStateException("No se pudo enviar el correo de recuperación. Inténtalo de nuevo más tarde.");
        }
        log.info("[AUDITORÍA] Email de recuperación enviado a: {}", emailN);
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        final String t = Optional.ofNullable(token).map(String::trim).orElse("");
        if (t.isEmpty()) {
            throw new IllegalArgumentException("Token no proporcionado");
        }

        User user = userDao.findByResetPasswordToken(t);

        if (user == null || user.getResetPasswordExpires() == null) {
            log.warn("[AUDITORÍA] Intento de uso de token inválido: {}", t);
            throw new IllegalStateException("Token inválido o caducado. Solicita uno nuevo.");
        }

        if (user.getResetPasswordExpires().isBefore(LocalDateTime.now())) {
            log.warn("[AUDITORÍA] Token caducado: {} para email: {}", t, user.getEmail());
            throw new IllegalStateException("Token caducado. Solicita uno nuevo.");
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("La nueva contraseña debe tener al menos 8 caracteres");
        }

        if (org.mindrot.jbcrypt.BCrypt.checkpw(newPassword, user.getPwd())) {
            throw new IllegalArgumentException("La nueva contraseña no puede ser igual a la anterior");
        }

        String hashed = org.mindrot.jbcrypt.BCrypt.hashpw(newPassword, org.mindrot.jbcrypt.BCrypt.gensalt());
        user.setPwd(hashed);
        user.setResetPasswordToken(null);
        user.setResetPasswordExpires(null);
        userDao.save(user);

        log.info("[AUDITORÍA] Contraseña restablecida para: {}", user.getEmail());
    }

    public List<User> listarUsuarios() {
        return userDao.findAll();
    }



}
