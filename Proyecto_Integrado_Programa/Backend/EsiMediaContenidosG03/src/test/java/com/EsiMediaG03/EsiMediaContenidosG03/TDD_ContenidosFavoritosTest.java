package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dao.ListaPublicaDAO;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.model.ListaPublica;
import com.EsiMediaG03.services.ContenidoService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TDD_ContenidosFavoritosTest {

    @Mock
    MongoTemplate mongoTemplate;

    @Mock
    ListaPublicaDAO listaPublicaDAO;

    @InjectMocks
    ContenidoService service; 

    @BeforeEach
    void setUpSecurity() {
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDownSecurity() {
        SecurityContextHolder.clearContext();
    }

    
    private void asUsuario(String email) {
        Authentication a = new UsernamePasswordAuthenticationToken(
                email, "N/A", List.of(new SimpleGrantedAuthority("ROLE_USUARIO")));
        SecurityContextHolder.getContext().setAuthentication(a);
    }
    private void asGestor(String email) {
        Authentication a = new UsernamePasswordAuthenticationToken(
                email, "N/A", List.of(new SimpleGrantedAuthority("ROLE_GESTOR_CONTENIDO")));
        SecurityContextHolder.getContext().setAuthentication(a);
    }
    private void asAdmin(String email) {
        Authentication a = new UsernamePasswordAuthenticationToken(
                email, "N/A", List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRADOR")));
        SecurityContextHolder.getContext().setAuthentication(a);
    }

  

    @Test
    @DisplayName("addFavorito OK -> ROLE_USUARIO y política permite (sin listas privadas)")
    void addFavorito_ok() {
        asUsuario("user@example.com");
        when(mongoTemplate.findById("CNT-123", Contenido.class)).thenReturn(new Contenido());
        when(listaPublicaDAO.findByContenidosIdsContains("CNT-123")).thenReturn(List.of()); // no privadas

        service.addFavorito("CNT-123");

        verify(mongoTemplate, times(1)).updateFirst(any(Query.class), any(), eq(Contenido.class));
        verifyNoMoreInteractions(mongoTemplate);
    }

    @Test
    @DisplayName("addFavorito FORBIDDEN -> política: contenido en una ListaPublica privada")
    void addFavorito_forbidden_policy() {
        asUsuario("user@example.com");
        when(mongoTemplate.findById("CNT-PRIV", Contenido.class)).thenReturn(new Contenido());
        ListaPublica privada = new ListaPublica(); privada.setPublica(false);
        when(listaPublicaDAO.findByContenidosIdsContains("CNT-PRIV")).thenReturn(List.of(privada));

        assertThrows(AccessDeniedException.class, () -> service.addFavorito("CNT-PRIV"));
        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(), eq(Contenido.class));
    }

    @Test
    @DisplayName("addFavorito FORBIDDEN -> ROLE_GESTOR_CONTENIDO")
    void addFavorito_forbidden_gestor() {
        asGestor("gestor@example.com");
        assertThrows(AccessDeniedException.class, () -> service.addFavorito("CNT-999"));
        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(), eq(Contenido.class));
        verifyNoInteractions(listaPublicaDAO);
    }

    @Test
    @DisplayName("addFavorito FORBIDDEN -> ROLE_ADMINISTRADOR")
    void addFavorito_forbidden_admin() {
        asAdmin("admin@example.com");
        assertThrows(AccessDeniedException.class, () -> service.addFavorito("CNT-777"));
        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(), eq(Contenido.class));
        verifyNoInteractions(listaPublicaDAO);
    }

    

    @Test
    @DisplayName("removeFavorito -> idempotente ($pull); no falla si no estaba")
    void removeFavorito_ok() {
        asUsuario("user@example.com");
        service.removeFavorito("CNT-XYZ");
        verify(mongoTemplate, times(1)).updateFirst(any(Query.class), any(), eq(Contenido.class));
    }

    

    @Test
    @DisplayName("listFavoritosIdsDeUsuarioActual -> devuelve IDs en el orden obtenido")
    void listFavoritos_returnsIds() {
        asUsuario("user@example.com");

        Contenido cA = mock(Contenido.class); when(cA.getId()).thenReturn("C3");
        Contenido cB = mock(Contenido.class); when(cB.getId()).thenReturn("C2");
        Contenido cC = mock(Contenido.class); when(cC.getId()).thenReturn("C1");
        when(mongoTemplate.find(any(Query.class), eq(Contenido.class))).thenReturn(List.of(cA, cB, cC));

        List<String> ids = service.listFavoritosIdsDeUsuarioActual();

        assertEquals(List.of("C3","C2","C1"), ids);
    }
}