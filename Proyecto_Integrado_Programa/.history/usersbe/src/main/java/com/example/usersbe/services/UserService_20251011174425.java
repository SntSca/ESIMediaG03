package com.example.usersbe.services;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.model.User;
import com.example.usersbe.services.dto.RegisterRequest;
import com.example.usersbe.services.exceptions.InvalidEmailException;
import com.example.usersbe.services.exceptions.PasswordPolicyException;
import com.example.usersbe.services.exceptions.TokenInvalidOrExpiredException;
import com.example.usersbe.services.exceptions.UserAlreadyExistsException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.security.SecureRandom;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private static final Pattern EMAIL_VALIDO =
        Pattern.compile("^[A-Za-z0-9._%+-áéíóúÁÉÍÓÚñÑ]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private static final int TOKEN_BYTES = 32;

    private final UserDao userDao;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    private final String frontendBaseUrl;
    private final Duration resetTtl;

    public UserService(
            UserDao userDao,
            EmailService emailService,
            PasswordEncoder passwordEncoder,
            @Value("${app.frontend.base-url:http://localhost:4200}") String frontendBaseUrl,
            @Value("${security.reset-token.ttl-hours:1}") long ttlHours
    ) {
        this.userDao = Objects.requireNonNull(userDao);
        this.emailService = Objects.requireNonNull(emailService);
        this.passwordEncoder = Objects.requireNonNull(passwordEncoder);
        this.frontendBaseUrl = Objects.requireNonNull(frontendBaseUrl);
        this.resetTtl = Duration.ofHours(ttlHours);
    }

    // ---------------------------
    // Registro
    // ---------------------------
    @Transactional
    public void registrar(RegisterRequest req) throws UserAlreadyExistsException, InvalidEmailException {
        final String emailNormalizado = Optional.ofNullable(req.getEmail())
                .map(String::trim)
                .map(String::toLowerCase)
                .orElse("");

        if (!EMAIL_VALIDO.matcher(emailNormalizado).matches()) {
            throw new InvalidEmailException("Dirección de correo inválida: " + req.getEmail());
        }

        if (userDao.findByEmail(emailNormalizado) != null) {
            throw new UserAlreadyExistsException("El usuario ya existe");
        }

        final String hashed = passwordEncoder.encode(req.getPwd());

        User user = new User();
        user.setNombre(req.getNombre());
        user.setApellidos(req.getApellidos());
        user.setAlias(req.getAlias());
        user.setEmail(emailNormalizado);
        user.setFechaNac(LocalDate.parse(req.getFechaNac()));
        user.setPwd(hashed);
        user.setVip(req.isVip());
        user.setFoto(req.getFoto());
        user.setRole(req.getRole());

        userDao.save(user);
        log.info("[AUDITORÍA] Usuario registrado: {}", emailNormalizado);
    }

    // ---------------------------
    // Recuperación de contraseña
    // ---------------------------
    @Transactional
    public void sendPasswordRecoveryEmail(String email) throws InvalidEmailException {
        if (email == null || email.isBlank() || !EMAIL_VALIDO.matcher(email).matches()) {
            throw new InvalidEmailException("Dirección de correo inválida: " + email);
        }

        final String emailN = email.trim().toLowerCase();
        User user = userDao.findByEmail(emailN);

        // Evitamos filtrar información: si no existe, salimos en silencio.
        if (user == null) {
            log.debug("Solicitud de recuperación para email no registrado: {}", emailN);
            return;
        }

        String token = generarTokenSeguro();
        user.setResetPasswordToken(token);
        user.setResetPasswordExpires(LocalDateTime.now().plus(resetTtl));
        userDao.save(user);

        String link = frontendBaseUrl.endsWith("/")
                ? frontendBaseUrl + "auth/reset-password?token=" + token
                : frontendBaseUrl + "/auth/reset-password?token=" + token;

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
                    <p>Este enlace caducará en <strong>%d hora%s</strong>.</p>
                    <p>Si no solicitaste este cambio, ignora este mensaje.</p>
                    <p>Atentamente,<br><strong>El equipo de EsiMedia 🎬</strong></p>
                    <div class="footer">© 2025 EsiMedia - Todos los derechos reservados.</div>
                </div>
            </body>
        </html>
        """.formatted(
                Optional.ofNullable(user.getNombre()).orElse("usuario"),
                link,
                resetTtl.toHours(),
                resetTtl.toHours() == 1 ? "" : "s"
        );

        emailService.sendMail(user.getEmail(), "Recuperación de contraseña - EsiMedia", body);
        log.info("[AUDITORÍA] Email de recuperación enviado a: {}", emailN);
    }

    @Transactional
    public void resetPassword(String token, String newPassword)
            throws TokenInvalidOrExpiredException, PasswordPolicyException {

        final String tokenTrim = Optional.ofNullable(token).map(String::trim).orElse("");
        if (tokenTrim.isEmpty()) {
            throw new TokenInvalidOrExpiredException("Token no proporcionado");
        }

        User user = userDao.findByResetPasswordToken(tokenTrim);

        if (user == null || user.getResetPasswordExpires() == null) {
            log.warn("[AUDITORÍA] Intento de uso de token inválido: {}", tokenTrim);
            throw new TokenInvalidOrExpiredException("Token inválido o caducado. Solicita uno nuevo.");
        }

        if (user.getResetPasswordExpires().isBefore(LocalDateTime.now())) {
            log.warn("[AUDITORÍA] Token caducado: {} para email: {}", tokenTrim, user.getEmail());
            throw new TokenInvalidOrExpiredException("Token caducado. Solicita uno nuevo.");
        }

        validarPoliticaPassword(newPassword);

        // Evitar reutilización inmediata de la misma contraseña
        if (passwordEncoder.matches(newPassword, user.getPwd())) {
            throw new PasswordPolicyException("La nueva contraseña no puede ser igual a la anterior");
        }

        user.setPwd(passwordEncoder.encode(newPassword));
        user.setResetPasswordToken(null);
        user.setResetPasswordExpires(null);
        userDao.save(user);

        log.info("[AUDITORÍA] Contraseña restablecida para: {}", user.getEmail());
    }

    public List<User> listarUsuarios() {
        return userDao.findAll();
    }

    // ---------------------------
    // Helpers
    // ---------------------------
    private static String generarTokenSeguro() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static void validarPoliticaPassword(String pwd) throws PasswordPolicyException {
        if (pwd == null || pwd.length() < 8) {
            throw new PasswordPolicyException("La nueva contraseña debe tener al menos 8 caracteres");
        }
        // Aquí puedes añadir reglas extra (mayús, minús, dígitos, símbolos, etc.)
    }
}
