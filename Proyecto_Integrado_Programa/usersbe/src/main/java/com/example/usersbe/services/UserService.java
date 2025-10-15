package com.example.usersbe.services;

import org.springframework.stereotype.Service;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.exceptions.EmailSendException;
import com.example.usersbe.exceptions.ExpiredTokenException;
import com.example.usersbe.exceptions.InvalidEmailException;
import com.example.usersbe.exceptions.InvalidFieldException;
import com.example.usersbe.exceptions.InvalidPasswordException;
import com.example.usersbe.exceptions.InvalidTokenException;
import com.example.usersbe.exceptions.UserAlreadyExistsException;
import com.example.usersbe.model.User;

import jakarta.mail.MessagingException;

import java.time.LocalDate;
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
    private String normalizeEmail(String email) {
        return (email == null) ? "" : email.trim().toLowerCase();
    }

    private void validateEmail(String email) {
        if (email == null || email.isBlank() || !EMAIL_VALIDO.matcher(email).matches()) {
            throw new InvalidEmailException("Dirección de correo inválida: " + email);
        }
    }

    private void checkUserExists(String emailNormalizado) {
        if (userDao.findByEmail(emailNormalizado) != null) {
            throw new UserAlreadyExistsException(emailNormalizado);
        }
    }

    public boolean isAliasAvailable(String aliasRaw) {
        if (aliasRaw == null || aliasRaw.trim().isEmpty()) return false;
        final String alias = aliasRaw.trim();
        return !userDao.existsByAliasIgnoreCase(alias);
    }

    private String hashPassword(String pwd) {
        return org.mindrot.jbcrypt.BCrypt.hashpw(pwd, org.mindrot.jbcrypt.BCrypt.gensalt());
    }

    private String generateToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public void registrar(String nombre, String apellidos, String alias, String email,
                          String fechaNac, String pwd, boolean vip, String foto,
                          User.Role role,
                          String descripcion, String especialidad, User.TipoContenido tipoContenido) {

        // Validaciones mínimas
        if (alias == null || alias.trim().isEmpty()) {
            throw new InvalidFieldException("El alias es obligatorio");
        }
        if (!isAliasAvailable(alias)) {
            throw new InvalidFieldException("El alias ya está en uso");
        }
        if (foto == null || foto.isBlank()) {
            throw new InvalidFieldException("La foto (avatar) es obligatoria");
        }
        validateEmail(email);
        final String emailN = normalizeEmail(email);
        checkUserExists(emailN);

        if (role == User.Role.GESTOR_CONTENIDO) {
            if (descripcion == null || descripcion.trim().isEmpty()) {
                throw new InvalidFieldException("La descripción es obligatoria para Gestor de Contenido");
            }
            if (especialidad == null || especialidad.trim().isEmpty()) {
                throw new InvalidFieldException("La especialidad es obligatoria para Gestor de Contenido");
            }
            if (tipoContenido == null) {
                throw new InvalidFieldException("El tipo de contenido (Audio/Video) es obligatorio para Gestor de Contenido");
            }
        }

        User user = buildUser(
            nombre, apellidos, alias, emailN, fechaNac, pwd, vip, foto, role,
            descripcion, especialidad, tipoContenido
        );

        userDao.save(user);
    }

    private User buildUser(String nombre, String apellidos, String alias, String email,
                           String fechaNac, String pwd, boolean vip, String foto,
                           User.Role role,
                           String descripcion, String especialidad, User.TipoContenido tipoContenido) {

        User user = new User();
        user.setNombre(nombre != null ? nombre.trim() : null);
        user.setApellidos(apellidos != null ? apellidos.trim() : null);
        user.setAlias(alias.trim());
        user.setEmail(email);
        user.setFechaNac(LocalDate.parse(fechaNac));
        user.setPwd(hashPassword(pwd));
        user.setVip(vip);
        user.setFoto(foto);
        user.setRole(role);

        if (role == User.Role.GESTOR_CONTENIDO) {
            user.setDescripcion(descripcion);
            user.setEspecialidad(especialidad);
            user.setTipoContenido(tipoContenido);
        }

        return user;
    }

    public void sendPasswordRecoveryEmail(String email) {
        validateEmail(email);
        String emailN = normalizeEmail(email);
        User user = userDao.findByEmail(emailN);
        if (user == null) {
            return;
        }

        String token = generateToken();
        user.setResetPasswordToken(token);
        user.setResetPasswordExpires(LocalDateTime.now().plusHours(1));
        userDao.save(user);

        sendRecoveryEmail(user, token);
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
                    h1 { color: #333333; }
                    p  { font-size: 16px; line-height: 1.5; }
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
                    .btn:hover { background-color: #0056b3; }
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
        """.formatted(nombre != null ? nombre : "usuario", link);
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

    private void validateNewPassword(String newPassword, String oldPasswordHash) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new InvalidPasswordException("La nueva contraseña debe tener al menos 8 caracteres");
        }
        if (org.mindrot.jbcrypt.BCrypt.checkpw(newPassword, oldPasswordHash)) {
            throw new InvalidPasswordException("La nueva contraseña no puede ser igual a la anterior");
        }
    }



    public List<User> listarUsuarios() {
        return userDao.findAll();
    }

    public List<User> listarCreadores(String search, Boolean blocked) {
        boolean hasSearch = (search != null && !search.isBlank());
        if (hasSearch) {
            String q = search.trim();
            if (blocked == null) return userDao.searchCreators(User.Role.GESTOR_CONTENIDO, q);
            return userDao.searchCreatorsByBlocked(User.Role.GESTOR_CONTENIDO, q, blocked);
        } else {
            if (blocked == null) return userDao.findByRole(User.Role.GESTOR_CONTENIDO);
            return userDao.findByRoleAndBlocked(User.Role.GESTOR_CONTENIDO, blocked);
        }
    }

    public User actualizarCreador(String id, String alias, String nombre,
                                  String apellidos, String email, String foto) throws Exception {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new Exception("Creador no encontrado");
        if (u.getRole() != User.Role.GESTOR_CONTENIDO)
            throw new Exception("El usuario indicado no es un creador");

        if (alias != null && !alias.isBlank()) {
            String aliasTrim = alias.trim();
            User byAlias = userDao.findByAlias(aliasTrim);
            if (byAlias != null && !byAlias.getId().equals(u.getId()))
                throw new Exception("El alias ya está en uso");
            u.setAlias(aliasTrim);
        }

        if (nombre != null)    u.setNombre(nombre.trim());
        if (apellidos != null) u.setApellidos(apellidos.trim());

        if (email != null && !email.isBlank()) {
            String emailN = normalizeEmail(email);
            validateEmail(emailN);
            User byMail = userDao.findByEmail(emailN);
            if (byMail != null && !byMail.getId().equals(u.getId()))
                throw new Exception("El email ya está en uso");
            u.setEmail(emailN);
        }

        if (foto != null) u.setFoto(foto);

        return userDao.save(u);
    }

    public User bloquearCreador(String id) throws Exception {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new Exception("Creador no encontrado");
        if (u.getRole() != User.Role.GESTOR_CONTENIDO)
            throw new Exception("El usuario indicado no es un creador");

        if (Boolean.TRUE.equals(u.isBlocked())) {
            audit("BLOCK (idempotente)", u);
            return u;
        }
        u.setBlocked(true);
        userDao.save(u);
        audit("BLOCK", u);
        return u;
    }

    public User desbloquearCreador(String id) throws Exception {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new Exception("Creador no encontrado");
        if (u.getRole() != User.Role.GESTOR_CONTENIDO)
            throw new Exception("El usuario indicado no es un creador");

        if (!Boolean.TRUE.equals(u.isBlocked())) {
            audit("UNBLOCK (idempotente)", u);
            return u;
        }
        u.setBlocked(false);
        userDao.save(u);
        audit("UNBLOCK", u);
        return u;
    }

    public void eliminarCreador(String id) throws Exception {
        User u = userDao.findById(id).orElse(null);
        if (u == null) throw new Exception("Creador no encontrado");
        if (u.getRole() != User.Role.GESTOR_CONTENIDO)
            throw new Exception("El usuario indicado no es un creador");

        userDao.deleteById(id);
        audit("DELETE", u);
    }

    private void audit(String action, User u) {
        System.out.printf("[AUDITORÍA] %s | creatorId=%s alias=%s email=%s at=%s%n",
                action, u.getId(), u.getAlias(), u.getEmail(), LocalDateTime.now());
    }
}
