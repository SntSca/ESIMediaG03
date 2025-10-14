package com.example.usersbe.http;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.usersbe.model.User;
import com.example.usersbe.services.UserService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("users")
@CrossOrigin("*")
public class UserController {

    private final UserService userService;
    public UserController(UserService userService) {
        this.userService = userService;
    }

    private static final int MAX_ATTEMPTS = 3;
    private static final long WINDOW_MS = 10L * 60 * 1000; // 10 min
    private final File logFile = new File("logs/forgot-password.log");

    private static final java.util.regex.Pattern EMAIL_RX =
        java.util.regex.Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    // Literales comunes
    private static final String FIELD_EMAIL = "email";
    private static final String FIELD_MESSAGE = "message";

    /* ==========================
     *  NUEVO: Check Alias
     * ========================== */
    @GetMapping("/check-alias/{alias}")
    public Map<String, Object> checkAlias(@PathVariable("alias") String alias) {
        boolean available = userService.isAliasAvailable(alias);
        return Map.of("available", available);
    }

    /* ==========================
     *  Registrar
     * ========================== */
    @PostMapping("/Registrar")
    public void registrar(@RequestBody Map<String, String> info) {
        // ahora alias y foto son obligatorios
        validarCamposObligatorios(info, "nombre", "apellidos", FIELD_EMAIL, "fechaNac", "pwd", "pwd2", "role", "alias", "foto");

        String nombre    = trim(info.get("nombre"));
        String apellidos = trim(info.get("apellidos"));
        String alias     = trim(info.get("alias"));
        String email     = trim(info.get(FIELD_EMAIL));
        String fechaNac  = trim(info.get("fechaNac"));
        String pwd       = info.get("pwd");
        String pwd2      = info.get("pwd2");
        boolean vip      = Boolean.parseBoolean(info.getOrDefault("vip", "false"));
        String foto      = trim(info.get("foto"));

        validarEmail(email);
        validarContrasena(pwd, pwd2);

        User.Role role = parseRole(trim(info.get("role")));

        // Campos extra si es GESTOR_CONTENIDO
        String descripcion = null;
        String especialidad = null;
        User.TipoContenido tipoContenido = null;

        if (role == User.Role.GESTOR_CONTENIDO) {
            validarCamposObligatorios(info, "descripcion", "especialidad", "tipoContenido");
            descripcion = trim(info.get("descripcion"));
            especialidad = trim(info.get("especialidad"));
            tipoContenido = parseTipoContenido(trim(info.get("tipoContenido")));
        }

        try {
            userService.registrar(
                nombre, apellidos, alias, email, fechaNac, pwd, vip, foto, role,
                descripcion, especialidad, tipoContenido
            );
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    /* ==========================
     *  Utilidades de validación
     * ========================== */
    private static String trim(String s) { return s == null ? "" : s.trim(); }

    private void validarCamposObligatorios(Map<String, String> info, String... campos) {
        for (String campo : campos) {
            if (!info.containsKey(campo) || info.get(campo) == null || info.get(campo).trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Falta el campo: " + campo);
            }
        }
    }

    private void validarEmail(String email) {
        if (!EMAIL_RX.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email no válido");
        }
    }

    private void validarContrasena(String pwd, String pwd2) {
        if (!String.valueOf(pwd).equals(String.valueOf(pwd2))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Las contraseñas no coinciden");
        }
        String issue = firstPasswordIssue(pwd);
        if (issue != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La contraseña debe contener " + issue);
        }
    }

    private static String firstPasswordIssue(String pwd) {
        if (pwd == null || pwd.length() < 8) return "al menos 8 caracteres";
        if (!pwd.chars().anyMatch(Character::isUpperCase)) return "una letra mayúscula";
        if (!pwd.chars().anyMatch(Character::isLowerCase)) return "una letra minúscula";
        if (!pwd.chars().anyMatch(Character::isDigit))     return "un número";
        if (!pwd.matches(".*[!@#$%^&*(),.?\":{}|<>_\\-].*"))  return "un carácter especial";
        return null;
    }

    private User.Role parseRole(String roleStr) {
        String norm = roleStr.toUpperCase(Locale.ROOT)
                .replace("Á", "A").replace("É", "E")
                .replace("Í", "I").replace("Ó", "O").replace("Ú", "U");

        return switch (norm) {
            case "USUARIO" -> User.Role.USUARIO;
            case "GESTOR DE CONTENIDO", "GESTOR_CONTENIDO" -> User.Role.GESTOR_CONTENIDO;
            case "ADMINISTRADOR" -> User.Role.ADMINISTRADOR;
            default -> throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Rol no permitido. Usa: USUARIO | GESTOR DE CONTENIDO | ADMINISTRADOR"
            );
        };
    }

    private User.TipoContenido parseTipoContenido(String tipo) {
        String norm = Optional.ofNullable(tipo)
                              .map(t -> t.trim().toUpperCase(Locale.ROOT))
                              .orElse("");
        return switch (norm) {
            case "AUDIO" -> User.TipoContenido.AUDIO;
            case "VIDEO" -> User.TipoContenido.VIDEO;
            default -> throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tipoContenido debe ser AUDIO o VIDEO");
        };
    }

    private int countRecentAttempts(String ip) {
        if (!logFile.exists()) return 0;
        int count = 0;
        long now = System.currentTimeMillis();

        try (BufferedReader br = new BufferedReader(new FileReader(logFile))) {
            String line;
            while ((line = br.readLine()) != null) {
                String[] parts = line.split("\\|");
                if (parts.length < 2) continue;
                long timestamp = Long.parseLong(parts[0]);
                String logIp = parts[1];
                if (logIp.equals(ip) && now - timestamp <= WINDOW_MS) {
                    count++;
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        return count;
    }

    private void logAttempt(String ip) {
        try {
            logFile.getParentFile().mkdirs();
            try (FileWriter fw = new FileWriter(logFile, true)) {
                fw.write(System.currentTimeMillis() + "|" + ip + "\n");
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(HttpServletRequest request, @RequestBody Map<String, String> body) {
        String ip = request.getRemoteAddr();
        int attempts = countRecentAttempts(ip);
        if (attempts >= MAX_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Has superado el límite de intentos. Intenta de nuevo más tarde.");
        }

        logAttempt(ip);

        try {
            String email = Optional.ofNullable(body.get(FIELD_EMAIL))
                        .map(String::trim)
                        .map(s -> s.toLowerCase(Locale.ROOT))
                        .orElse("");

            userService.sendPasswordRecoveryEmail(email);
            return ResponseEntity.ok(Map.of(FIELD_MESSAGE, "Si el email existe, se ha enviado un enlace de recuperación."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                 .body(Map.of(FIELD_MESSAGE, e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> body) {
        try {
            String token = body.get("token");
            String newPassword = body.get("newPassword");
            userService.resetPassword(token, newPassword);
            return ResponseEntity.ok(Map.of(FIELD_MESSAGE, "Contraseña actualizada correctamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                 .body(Map.of(FIELD_MESSAGE, e.getMessage()));
        }
    }

    @GetMapping("/listarUsuarios")
    public List<User> getAll() {
        return userService.listarUsuarios();
    }
}
