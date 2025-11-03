package com.EsiMediaG03.EsiMediaContenidosG03;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.exceptions.ContenidoException;
import com.EsiMediaG03.exceptions.ContenidoValidationException;
import com.EsiMediaG03.http.ContenidoController;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.*;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TDDValoracionContenidoTest {

    @Mock ContenidoDAO contenidoDAO;
    @Mock MongoTemplate mongoTemplate;
    @InjectMocks ContenidoService serviceUnderTest;

    @Mock ContenidoService contenidoServiceMock;
    @InjectMocks ContenidoController controllerUnderTest;

    private Contenido contenido;

    @BeforeEach
    void baseInit() {
        
        contenido = new Contenido();
        try {
            var idField = Contenido.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(contenido, "C1");
        } catch (Exception ignored) {}

        contenido.setReproductores(new HashSet<>(List.of("user@esi.com")));

        contenido.setRatings(new HashMap<>());
        contenido.setRatingAvg(0.0);
        contenido.setRatingCount(0);

        when(contenidoDAO.findById("C1")).thenReturn(Optional.of(contenido));
        when(contenidoDAO.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Nested
    @DisplayName("ContenidoService - Rating")
    class ServiceRatingTests {

        @Test
        @DisplayName("Primera valoración -> count=1 y avg=score")
        void primerVoto_ok() {
            Map<String,Object> res = serviceUnderTest.rateContenido("C1", "user@esi.com", 5);
            assertEquals(1, res.get("count"));
            assertEquals(5.0, (double)res.get("avg"));
            assertEquals(5, ((Map<?,?>)res.get("ratings")).get("user@esi.com"));
            verify(contenidoDAO, times(1)).save(any());
        }

        @Test
        @DisplayName("Actualizar voto del mismo usuario -> count no sube, avg recalculado")
        void actualizaVoto_ok() {
            serviceUnderTest.rateContenido("C1", "user@esi.com", 5);
            Map<String,Object> res = serviceUnderTest.rateContenido("C1", "user@esi.com", 3);
            assertEquals(1, res.get("count"));
            assertEquals(3.0, (double)res.get("avg"));
            assertEquals(3, ((Map<?,?>)res.get("ratings")).get("user@esi.com"));
            verify(contenidoDAO, atLeast(2)).save(any());
        }

        @Test
        @DisplayName("Score inválido (fuera 1..5) -> ContenidoValidationException")
        void scoreInvalido() {
            assertThrows(ContenidoValidationException.class,
                    () -> serviceUnderTest.rateContenido("C1", "user@esi.com", 0));
            assertThrows(ContenidoValidationException.class,
                    () -> serviceUnderTest.rateContenido("C1", "user@esi.com", 6));
        }

        @Test
        @DisplayName("Usuario no reprodujo -> ContenidoException")
        void noReprodujo_forbidden() {
            assertThrows(ContenidoException.class,
                    () -> serviceUnderTest.rateContenido("C1", "otro@esi.com", 4));
        }

        @Test
        @DisplayName("Resumen -> devuelve count y avg")
        void resumen_ok() {
            serviceUnderTest.rateContenido("C1", "user@esi.com", 4);
            Map<String,Object> res = serviceUnderTest.ratingResumen("C1");
            assertEquals(1, res.get("count"));
            assertEquals(4.0, (double)res.get("avg"));
        }
    }

    @Nested
    @DisplayName("ContenidoController - Endpoints de rating")
    class ControllerRatingTests {

        @Test
        @DisplayName("POST /ValorarContenido/{id}/{score} -> 200 con avg y count")
        void postValorar_ok() {
            Map<String, Object> mockRes = new HashMap<>();
            mockRes.put("avg", 4.5);
            mockRes.put("count", 2);
            mockRes.put("ratings", Map.of("user@esi.com", 5, "otro@esi.com", 4));

            when(contenidoServiceMock.rateContenido("C1", "user@esi.com", 5)).thenReturn(mockRes);

            ResponseEntity<Map<String,Object>> resp =
                    controllerUnderTest.valorarContenido("C1", 5, "user@esi.com");

            assertEquals(HttpStatus.OK, resp.getStatusCode());
            assertEquals(4.5, resp.getBody().get("avg"));
            assertEquals(2, resp.getBody().get("count"));
        }

        @Test
        @DisplayName("GET /RatingContenido/{id} -> 200 con avg y count")
        void getRating_ok() {
            Map<String, Object> mockRes = new HashMap<>();
            mockRes.put("avg", 3.0);
            mockRes.put("count", 1);

            when(contenidoServiceMock.ratingResumen("C1")).thenReturn(mockRes);

            ResponseEntity<Map<String,Object>> resp = controllerUnderTest.ratingContenido("C1");
            assertEquals(HttpStatus.OK, resp.getStatusCode());
            assertEquals(3.0, resp.getBody().get("avg"));
            assertEquals(1, resp.getBody().get("count"));
        }
    }
}
