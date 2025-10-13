package com.EsiMediaG03.services;

import java.util.Optional;
import org.springframework.stereotype.Service;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.model.Contenido;

@Service
public class ContenidoService {

    private final ContenidoDAO contenidoDAO;

    public ContenidoService(ContenidoDAO contenidoDAO) {
        this.contenidoDAO = contenidoDAO;
    }

    public Contenido anadirContenido(Contenido contenido) throws Exception {
        validarContenido(contenido);
        return contenidoDAO.save(contenido);
    }

    public Contenido modificarContenido(Contenido contenido) throws Exception {
        if (contenido.getId() == null) {
            throw new IllegalArgumentException("El ID del contenido es obligatorio para modificar.");
        }
        Optional<Contenido> existente = contenidoDAO.findById(contenido.getId());
        if (existente.isEmpty()) {
            throw new IllegalArgumentException("No existe contenido con ID: " + contenido.getId());
        }
        validarcontenido(contenido);
        return contenidoDAO.save(contenido);
    }

}
