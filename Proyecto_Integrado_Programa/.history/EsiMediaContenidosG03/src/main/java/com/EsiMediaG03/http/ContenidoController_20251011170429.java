package com.EsiMediaG03.http;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.services.ContenidoService;

@RestController
@RequestMapping("Contenidos")
@CrossOrigin(origins = "*")
public class ContenidoController {

    @Autowired
    private ContenidoService contenidoService;

    @PostMapping("/AñadirContenido")
    public ResponseEntity<Contenido> añadirContenido(@RequestBody Contenido contenido) throws Exception {
        Contenido resultado = contenidoService.añadirContenido(contenido);
        return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
    }
 
    @PutMapping("/ModificarContenido")
    public ResponseEntity<Contenido> modificarContenido(@RequestBody Contenido contenido) throws Exception {
            Contenido resultado = contenidoService.modificarContenido(contenido);
            return ResponseEntity.ok(resultado);
        }

    @PostMapping("/EliminarContenido")
    public ResponseEntity<Void> eliminarContenido(@RequestBody Map<String, String> request) {
        try {
            String id = request.get("id");
            contenidoService.eliminarContenido(id);
            return ResponseEntity.noContent().build();
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
            }
        }

    @GetMapping("/ListarContenidos")
        public ResponseEntity<List<Contenido>> listarContenidos() {
            return ResponseEntity.ok(contenidoService.listarContenidos());
        }
        
    @PostMapping("/ListarContenidos")
        public ResponseEntity<List<Contenido>> listarContenidos(@RequestBody(required = false) Map<String, Object> filtro) {
            return ResponseEntity.ok(contenidoService.listarContenidos());
        }
    @PostMapping("/BuscarPorTitulo")
    public ResponseEntity<List<Contenido>> buscarPorTitulo(@RequestBody Map<String, String> request) {
        String titulo = request.get("titulo");
        if (titulo == null || titulo.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        List<Contenido> resultados = contenidoService.buscarPorTitulo(titulo);

        if (resultados.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(resultados);
    }

@PostMapping("/ListarFiltrados")
public ResponseEntity<List<Contenido>> listarFiltrados(@RequestBody(required = false) Map<String, Object> filtros) {
    boolean esVip = false;
    final Contenido.Tipo tipoFiltro;

    // Procesar filtros
    if (filtros != null) {
        // VIP
        if (filtros.containsKey("vip")) {
            esVip = Boolean.parseBoolean(filtros.get("vip").toString());
        }

        // Tipo
        if (filtros.containsKey("tipo")) {
            try {
                tipoFiltro = Contenido.Tipo.valueOf(filtros.get("tipo").toString().toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Collections.emptyList());
            }
        } else {
            tipoFiltro = null;
        }
    } else {
        tipoFiltro = null;
    }

    // Obtener contenidos visibles según VIP
    List<Contenido> visibles = contenidoService.listarVisibles(true); // obtenemos todos visibles

    // Filtrado por VIP: si el usuario no es VIP, eliminamos VIP y 4K
    if (!esVip) {
        visibles.removeIf(c -> c.isVip() || "4K".equalsIgnoreCase(c.getResolucion()));
    }

    // Filtrar por tipo si se indicó
    if (tipoFiltro != null) {
        visibles.removeIf(c -> c.getTipo() != tipoFiltro);
    }

    return ResponseEntity.ok(visibles);
}



    @PostMapping("/BuscarPorTags")
    public ResponseEntity<List<Contenido>> buscarPorTags(@RequestBody Map<String, List<String>> request) {
        List<String> tags = request.get("tags");
        if (tags == null || tags.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(contenidoService.buscarPorTags(tags));
    }

    @PostMapping("/BuscarPorTipo")
    public ResponseEntity<List<Contenido>> buscarPorTipo(@RequestBody Map<String, String> request) {
        String tipoStr = request.get("tipo");
        if (tipoStr == null || tipoStr.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            Contenido.Tipo tipo = Contenido.Tipo.valueOf(tipoStr.toUpperCase());
            return ResponseEntity.ok(contenidoService.buscarPorTipo(tipo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleException(Exception e) {
        if (e instanceof IllegalArgumentException) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(e.getMessage());
        }
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error interno: " + e.getMessage());
    }
}
