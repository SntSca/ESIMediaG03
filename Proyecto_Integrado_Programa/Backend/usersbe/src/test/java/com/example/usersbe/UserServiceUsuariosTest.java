package com.example.usersbe;

import com.example.usersbe.dao.UserDao;
import com.example.usersbe.exceptions.*;
import com.example.usersbe.model.User;
import com.example.usersbe.services.UserService; // ajusta si tu clase se llama distinto

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceUsuariosTest {

    @Mock private UserDao userDao;

    private UserService userService; // la instanciamos a mano

    private User u; // usuario básico común

    @BeforeEach
    void init() {
        // Construimos el servicio pasando null en deps que no usamos en estos tests
        userService = new UserService(userDao, /*emailService*/ null, /*emailOtpService*/ null);

        u = user("u1", "user1", "User", "One", "USER1@MAIL.COM", "foto.png",
                 User.Role.USUARIO, false);
    }

    // ---------- actualizarUsuario ----------
    @Test
    @DisplayName("actualizarUsuario: actualiza campos y normaliza email")
    void actualizarUsuario_ok() {
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        when(userDao.findByAlias("nuevo")).thenReturn(null);
        when(userDao.findByEmail("nuevo@mail.com")).thenReturn(null);
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        User res = userService.actualizarUsuario(
                "u1", "  nuevo ", "  Nombre ", " Apellidos ",
                "  NUEVO@mail.com  ", " avatar.png ");

        assertEquals("nuevo", res.getAlias());
        assertEquals("Nombre", res.getNombre());
        assertEquals("Apellidos", res.getApellidos());
        assertEquals("nuevo@mail.com", res.getEmail());
        assertEquals(" avatar.png ", res.getFoto()); // no trim en foto
    }

    @Test
    @DisplayName("actualizarUsuario: not found")
    void actualizarUsuario_notFound() {
        when(userDao.findById("x")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class,
                () -> userService.actualizarUsuario("x", null, null, null, null, null));
    }

    @Test
    @DisplayName("actualizarUsuario: rol inválido")
    void actualizarUsuario_rolInvalido() {
        User otro = user("c1", "crea", "C", "R", "c@mail.com", "f.png",
                         User.Role.GESTOR_CONTENIDO, false);
        when(userDao.findById("c1")).thenReturn(Optional.of(otro));
        assertThrows(InvalidRoleException.class,
                () -> userService.actualizarUsuario("c1", null, null, null, null, null));
    }

    @Test
    @DisplayName("actualizarUsuario: alias duplicado")
    void actualizarUsuario_aliasDuplicado() {
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        User otro = user("u2", "dup", "X", "Y", "x@mail.com", "f.png",
                         User.Role.USUARIO, false);
        when(userDao.findByAlias("dup")).thenReturn(otro);
        assertThrows(DuplicateAliasException.class,
                () -> userService.actualizarUsuario("u1", "dup", null, null, null, null));
    }

    @Test
    @DisplayName("actualizarUsuario: email duplicado")
    void actualizarUsuario_emailDuplicado() {
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        when(userDao.findByAlias(any())).thenReturn(null);
        User otro = user("u2", "x", "X", "Y", "dup@mail.com", "f.png",
                         User.Role.USUARIO, false);
        when(userDao.findByEmail("dup@mail.com")).thenReturn(otro);
        assertThrows(DuplicateEmailException.class,
                () -> userService.actualizarUsuario("u1", "ok", null, null, "dup@mail.com", null));
    }

    // ---------- bloquearUsuario ----------
    @Test
    @DisplayName("bloquearUsuario: bloquea si estaba desbloqueado")
    void bloquearUsuario_cambia() {
        u.setBlocked(false);
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        User res = userService.bloquearUsuario("u1");
        assertTrue(res.isBlocked());
        verify(userDao).save(any(User.class));
    }

    @Test
    @DisplayName("bloquearUsuario: idempotente si ya estaba bloqueado")
    void bloquearUsuario_idempotente() {
        u.setBlocked(true);
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        User res = userService.bloquearUsuario("u1");
        assertTrue(res.isBlocked());
        verify(userDao, never()).save(any());
    }

    // ---------- desbloquearUsuario ----------
    @Test
    @DisplayName("desbloquearUsuario: desbloquea si estaba bloqueado")
    void desbloquearUsuario_cambia() {
        u.setBlocked(true);
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        when(userDao.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        User res = userService.desbloquearUsuario("u1");
        assertFalse(res.isBlocked());
        verify(userDao).save(any(User.class));
    }

    @Test
    @DisplayName("desbloquearUsuario: idempotente si ya estaba desbloqueado")
    void desbloquearUsuario_idempotente() {
        u.setBlocked(false);
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        User res = userService.desbloquearUsuario("u1");
        assertFalse(res.isBlocked());
        verify(userDao, never()).save(any());
    }

    // ---------- eliminarUsuario ----------
    @Test
    @DisplayName("eliminarUsuario: prohibido si existe (UserDeletionNotAllowedException)")
    void eliminarUsuario_prohibido() {
        when(userDao.findById("u1")).thenReturn(Optional.of(u));
        assertThrows(UserDeletionNotAllowedException.class,
                () -> userService.eliminarUsuario("u1"));
        verify(userDao, never()).deleteById(anyString());
    }

    @Test
    @DisplayName("eliminarUsuario: not found")
    void eliminarUsuario_notFound() {
        when(userDao.findById("no")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class,
                () -> userService.eliminarUsuario("no"));
    }

    // ---------- helper local ----------
    private static User user(String id, String alias, String nombre, String apellidos,
                             String email, String foto, User.Role role, boolean blocked) {
        User u = new User();
        u.setId(id);
        u.setAlias(alias);
        u.setNombre(nombre);
        u.setApellidos(apellidos);
        u.setEmail(email);
        u.setFoto(foto);
        u.setRole(role);
        u.setBlocked(blocked);
        return u;
    }
}
