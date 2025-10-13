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

    @PostMapping("/AnadirContenido")
    public ResponseEntity<Contenido> anadirContenido(@RequestBody Contenido contenido) throws Exception {
        Contenido resultado = contenidoService.anadirContenido(contenido);
        return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
    }


}
