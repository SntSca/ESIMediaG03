package com.example.usersbe.http;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;



@RestController
@RequestMapping("users")
@CrossOrigin("*")
public class UserController {

    @Autowired
    private UserService userService;

    private static final Logger logger = LoggerFactory.getLogger(UserController.class);
    private static final int MAX_ATTEMPTS = 3;
    private static final long WINDOW_MS = 10 * 60 * 1000;
    private File logFile = new File("logs/forgot-password.log");


    private static final java.util.regex.Pattern EMAIL_RX =
        java.util.regex.Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    @PostMapping("/Registrar")
    public void registrar(@RequestBody Map<String, String> info) {
        String[] oblig = {"nombre","apellidos","email","fechaNac","pwd","pwd2","role"};
        for (String campo : oblig) {
            if (!info.containsKey(campo) || info.get(campo) == null || info.get(campo).trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Falta el campo: " + campo);
            }
        }
        String nombre   = info.get("nombre").trim();
        String apellidos= info.get("apellidos").trim();
        String alias    = info.getOrDefault("alias","").trim();
        String email    = info.get("email").trim();
        String fechaNac = info.get("fechaNac").trim();
        String pwd      = info.get("pwd");
        String pwd2     = info.get("pwd2");
        boolean vip     = "true".equalsIgnoreCase(info.getOrDefault("vip","false"));
        String foto     = info.getOrDefault("foto", null);
        if (foto == null || foto.isBlank()) {
            foto = "/static/fotos/image.png"; 
        }
        String roleStr  = info.get("role").trim();
        

        if (!EMAIL_RX.matcher(email).matches())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email no válido");

        if (!pwd.equals(pwd2))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Las contraseñas no coinciden");

        String pwdIssue = firstPasswordIssue(pwd);
        if (pwdIssue != null)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La contraseña debe contener " + pwdIssue);

        java.time.LocalDate fnac;
        try {
            fnac = java.time.LocalDate.parse(fechaNac); 
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Formato de fecha inválido (YYYY-MM-DD)");
        }
        if (fnac.isAfter(java.time.LocalDate.now()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La fecha de nacimiento no puede ser futura");

        
        com.example.usersbe.model.User.Role role;
        String norm = roleStr.trim().toUpperCase().replace("Á","A").replace("É","E")
                      .replace("Í","I").replace("Ó","O").replace("Ú","U");
        if ("USUARIO".equals(norm)) {
            role = com.example.usersbe.model.User.Role.USUARIO;
        } else if ("GESTOR DE CONTENIDO".equals(norm) || "GESTOR_CONTENIDO".equals(norm)) {
            role = com.example.usersbe.model.User.Role.GESTOR_CONTENIDO;
        } else if ("ADMINISTRADOR".equals(norm)) {
            role = com.example.usersbe.model.User.Role.ADMINISTRADOR;
        } else {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Rol no permitido. Usa: USUARIO | GESTOR DE CONTENIDO | ADMINISTRADOR");
        }

        try {
            userService.registrar(
                nombre, apellidos, alias, email, fechaNac, pwd, vip, foto, role
            );
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    private static String firstPasswordIssue(String pwd) {
        if (pwd == null || pwd.length() < 8) return "al menos 8 caracteres";
        if (!pwd.chars().anyMatch(Character::isUpperCase)) return "una letra mayúscula";
        if (!pwd.chars().anyMatch(Character::isLowerCase)) return "una letra minúscula";
        if (!pwd.chars().anyMatch(Character::isDigit))     return "un número";
        if (!pwd.matches(".*[!@#$%^&*(),.?\":{}|<>-_].*"))  return "un carácter especial";
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
    public ResponseEntity<?> forgotPassword(HttpServletRequest request , @RequestBody Map<String, String> body) {

        String ip = request.getRemoteAddr();

        int attempts = countRecentAttempts(ip);
        if (attempts >= MAX_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Has superado el límite de intentos. Intenta de nuevo más tarde.");
        }

        logAttempt(ip);

        try {
            String email = body.get("email");
            userService.sendPasswordRecoveryEmail(email);
            return ResponseEntity.ok(Map.of("message", "Si el email existe, se ha enviado un enlace de recuperación."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {

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
public ResponseEntity<List<UserDto>> listarUsuarios() {
        List<UserDto> usuarios = userService.obtenerTodos();
        return ResponseEntity.ok(usuarios);
    }
    
}

