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

        final String emailN = normalizeEmail(email);
        checkUserExists(emailN);

        User user = buildUser(nombre, apellidos, alias, emailN, fechaNac, pwd, vip, foto, role);
        userDao.save(user);
    }

    private String normalizeEmail(String email) {
        return (email == null) ? "" : email.trim().toLowerCase();
    }

    private void checkUserExists(String email) {
        if (userDao.findByEmail(email) != null) {
            throw new UserAlreadyExistsException(email);
        }
    }

    private User buildUser(String nombre, String apellidos, String alias, String email,
                           String fechaNac, String pwd, boolean vip, String foto,
                           User.Role role) {
        User user = new User();
        user.setNombre(nombre);
        user.setApellidos(apellidos);
        user.setAlias(alias);
        user.setEmail(email);
        user.setFechaNac(java.time.LocalDate.parse(fechaNac));
        user.setPwd(hashPassword(pwd));
        user.setVip(vip);
        user.setFoto((foto == null || foto.isBlank()) ? "/static/fotos/image.png" : foto);
        user.setRole(role);
        return user;
    }

    private String hashPassword(String pwd) {
        return org.mindrot.jbcrypt.BCrypt.hashpw(pwd, org.mindrot.jbcrypt.BCrypt.gensalt());
    }

    public void sendPasswordRecoveryEmail(String email) {
        validateEmail(email);

        User user = userDao.findByEmail(email);
        if (user == null) return;

        String token = generateToken();
        user.setResetPasswordToken(token);
        user.setResetPasswordExpires(LocalDateTime.now().plusHours(1));
        userDao.save(user);

        sendRecoveryEmail(user, token);
    }

    private void validateEmail(String email) {
        if (email == null || email.isBlank() || !EMAIL_VALIDO.matcher(email).matches()) {
            throw new InvalidEmailException("Dirección de correo inválida: " + email);
        }
    }

    private String generateToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void sendRecoveryEmail(User user, String token) {
        String link = "http://localhost:4200/auth/reset-password?token=" + token;
        String body = generateRecoveryHtml(user.getNombre(), link);
        try {
            emailService.sendMail(user.getEmail(), "Recuperación de contraseña - EsiMedia", body);
        } catch (MessagingException e) {
            throw new EmailSendException("Error enviando correo de recuperación", e);
        }
    }

    private String generateRecoveryHtml(String nombre, String link) {
        return """
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Recuperación de contraseña - EsiMedia</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f7;
                        color: #333;
                        padding: 20px;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background-color: #ffffff;
                        padding: 30px;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                        text-align: center;
                    }
                    h1 {
                        color: #333333;
                    }
                    p {
                        font-size: 16px;
                        line-height: 1.5;
                    }
                    .btn {
                        display: inline-block;
                        padding: 12px 24px;
                        margin-top: 20px;
                        font-size: 16px;
                        color: #ffffff;
                        background-color: #007BFF;
                        text-decoration: none;
                        border-radius: 5px;
                        transition: background-color 0.3s ease;
                    }
                    .btn:hover {
                        background-color: #0056b3;
                    }
                    .footer {
                        margin-top: 30px;
                        font-size: 12px;
                        color: #777;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Recuperación de contraseña</h1>
                    <p>Hola, <strong>%s</strong>,</p>
                    <p>Haz clic en el botón de abajo para restablecer tu contraseña:</p>
                    <a href="%s" class="btn">Restablecer contraseña</a>
                    <p class="footer">Si no solicitaste este correo, puedes ignorarlo.</p>
                </div>
            </body>
        </html>
        """.formatted(nombre, link);
    }


    public void resetPassword(String token, String newPassword) {
        User user = getUserByValidToken(token);
        validateNewPassword(newPassword, user.getPwd());

        user.setPwd(hashPassword(newPassword));
        user.setResetPasswordToken(null);
        user.setResetPasswordExpires(null);
        userDao.save(user);
    }

    private User getUserByValidToken(String token) {
        if (token == null || token.trim().isEmpty()) {
            throw new InvalidTokenException("Token no proporcionado");
        }

        User user = userDao.findByResetPasswordToken(token.trim());
        if (user == null || user.getResetPasswordExpires() == null) {
            throw new InvalidTokenException("Token inválido o caducado");
        }

        if (user.getResetPasswordExpires().isBefore(LocalDateTime.now())) {
            throw new ExpiredTokenException("Token caducado");
        }
        return user;
    }

    private void validateNewPassword(String newPassword, String oldPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new InvalidPasswordException("La nueva contraseña debe tener al menos 8 caracteres");
        }
        if (org.mindrot.jbcrypt.BCrypt.checkpw(newPassword, oldPassword)) {
            throw new InvalidPasswordException("La nueva contraseña no puede ser igual a la anterior");
        }
    }

    public List<User> listarUsuarios() {
        return userDao.findAll();
    }
}
