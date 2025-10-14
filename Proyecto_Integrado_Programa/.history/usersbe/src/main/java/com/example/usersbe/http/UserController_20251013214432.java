package com.example.usersbe.http;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.usersbe.model.User;
import com.example.usersbe.services.UserService;

import jakarta.servlet.http.HttpServletRequest;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;

@RestController
@RequestMapping("users")
@CrossOrigin("*")
public class UserController {

    private final UserService userService;
    public UserController(UserService userService) {
        this.userService = userService;
    }

    

    private static final int MAX_ATTEMPTS = 3;
    private static final long WINDOW_MS = 10L * 60 * 1000;
    private File logFile = new File("logs/forgot-password.log");


    private static final java.util.regex.Pattern EMAIL_RX =
        java.util.regex.Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    @PostMapping("/Registrar")
    public void registrar(@RequestBody Map<String, String> info) {
        // Validación de campos obligatorios
        validarCamposObligatorios(info, "nombre", "apellidos", "email", "fechaNac", "pwd", "pwd2", "role");

        // Extracción de datos con valores por defecto y limpieza
        String nombre    = info.get("nombre").trim();
        String apellidos = info.get("apellidos").trim();
        String alias     = info.getOrDefault("alias", "").trim();
        String email     = info.get("email").trim();
        String fechaNac  = info.get("fechaNac").trim();
        String pwd       = info.get("pwd");
        String pwd2      = info.get("pwd2");
        boolean vip      = Boolean.parseBoolean(info.getOrDefault("vip", "false"));
        String foto      = info.getOrDefault("foto", "/static/fotos/image.png");
        if (foto.isBlank()) foto = "/static/fotos/image.png";

        String roleStr   = info.get("role").trim();

        // Validaciones
        validarEmail(email);
        validarContrasena(pwd, pwd2);
        java.time.LocalDate fnac = parseFechaNacimiento(fechaNac);

        com.example.usersbe.model.User.Role role = parseRole(roleStr);

        // Registro del usuario
        try {
            userService.registrar(nombre, apellidos, alias, email, fechaNac, pwd, vip, foto, role);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    /** Valida que los campos obligatorios estén presentes y no vacíos */
    private void validarCamposObligatorios(Map<String, String> info, String... campos) {
        for (String campo : campos) {
            if (!info.containsKey(campo) || info.get(campo) == null || info.get(campo).trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Falta el campo: " + campo);
            }
        }
    }

    /** Valida el formato de email */
    private void validarEmail(String email) {
        if (!EMAIL_RX.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email no válido");
        }
    }

    /** Valida que las contraseñas coincidan y cumplan reglas */
    private void validarContrasena(String pwd, String pwd2) {
        if (!pwd.equals(pwd2)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Las contraseñas no coinciden");
        }
        String issue = firstPasswordIssue(pwd);
        if (issue != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La contraseña debe contener " + issue);
        }
    }

    /** Parsea la fecha de nacimiento y valida que no sea futura */
    private java.time.LocalDate parseFechaNacimiento(String fechaNac) {
        try {
            java.time.LocalDate fnac = java.time.LocalDate.parse(fechaNac);
            if (fnac.isAfter(java.time.LocalDate.now())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La fecha de nacimiento no puede ser futura");
            }
            return fnac;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Formato de fecha inválido (YYYY-MM-DD)");
        }
    }

    /** Normaliza y convierte el rol recibido a la enumeración correspondiente */
    private com.example.usersbe.model.User.Role parseRole(String roleStr) {
        String norm = roleStr.trim().toUpperCase()
                        .replace("Á", "A").replace("É", "E")
                        .replace("Í", "I").replace("Ó", "O").replace("Ú", "U");

        return switch (norm) {
            case "USUARIO" -> com.example.usersbe.model.User.Role.USUARIO;
            case "GESTOR DE CONTENIDO", "GESTOR_CONTENIDO" -> com.example.usersbe.model.User.Role.GESTOR_CONTENIDO;
            case "ADMINISTRADOR" -> com.example.usersbe.model.User.Role.ADMINISTRADOR;
            default -> throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Rol no permitido. Usa: USUARIO | GESTOR DE CONTENIDO | ADMINISTRADOR"
            );
        };
    }


    private static String firstPasswordIssue(String pwd) {
        if (pwd == null || pwd.length() < 8) return "al menos 8 caracteres";
        if (!pwd.chars().anyMatch(Character::isUpperCase)) return "una letra mayúscula";
        if (!pwd.chars().anyMatch(Character::isLowerCase)) return "una letra minúscula";
        if (!pwd.chars().anyMatch(Character::isDigit))     return "un número";
        if (!pwd.matches(".*[!@#$%^&*(),.?\":{}|<>_\\-].*"))  return "un carácter especial";
        return null;
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
    public ResponseEntity<Map<String, Object>> forgotPassword(HttpServletRequest request , @RequestBody Map<String, String> body) {

        String ip = request.getRemoteAddr();

        int attempts = countRecentAttempts(ip);
        if (attempts >= MAX_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Has superado el límite de intentos. Intenta de nuevo más tarde.");
        }

        logAttempt(ip);

        try {
            String email = java.util.Optional.ofNullable(body.get("email"))
                        .map(String::trim)
                        .map(s -> s.toLowerCase(java.util.Locale.ROOT))
                        .orElse("");

            userService.sendPasswordRecoveryEmail(email);
            return ResponseEntity.ok(Map.of("message", "Si el email existe, se ha enviado un enlace de recuperación."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> body) {

        try {
            String token = body.get("token");
            String newPassword = body.get("newPassword");
            userService.resetPassword(token, newPassword);
            return ResponseEntity.ok(Map.of("message", "Contraseña actualizada correctamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/listarUsuarios")
    public List<User> getAll() {
        return userService.listarUsuarios();
    }
    
}

