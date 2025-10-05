package com.example.usersbe.http;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.usersbe.services.UserService;


@RestController
@RequestMapping("users")
@CrossOrigin("*")
public class UserController {

    @Autowired
    private UserService userService;

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
        if (!pwd.matches(".*[!@#$%^&*(),.?\":{}|<>].*"))  return "un carácter especial";
        return null;
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            if (email == null || email.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Email requerido"));
            }
            userService.enviarTokenRecuperacion(email);
            return ResponseEntity.ok(Map.of("message", "Si el email existe, se envió un correo de recuperación"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Error interno del servidor"));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        try {
            String token = body.get("token");
            String pwd = body.get("pwd");
            String pwd2 = body.get("pwd2");

            if (token == null || token.isBlank() || pwd == null || pwd2 == null || !pwd.equals(pwd2)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Datos inválidos o contraseñas no coinciden"));
            }

            boolean ok = userService.cambiarPasswordConToken(token, pwd);
            if (!ok) {
                return ResponseEntity.status(400).body(Map.of("message", "Token inválido o caducado"));
            }

            return ResponseEntity.ok(Map.of("message", "Contraseña restablecida correctamente"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Error interno del servidor"));
        }
    }
 
}

