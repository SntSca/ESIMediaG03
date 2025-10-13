package com.EsiMediaG03.http;


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
    private final ContenidoService contenidoService;
    

    @PostMapping("/AnadirContenido")
    public ResponseEntity<Contenido> anadirContenido(@RequestBody Contenido contenido) throws Exception {
        Contenido resultado = contenidoService.anadirContenido(contenido);
        return ResponseEntity.status(HttpStatus.CREATED).body(resultado);
    }

}
