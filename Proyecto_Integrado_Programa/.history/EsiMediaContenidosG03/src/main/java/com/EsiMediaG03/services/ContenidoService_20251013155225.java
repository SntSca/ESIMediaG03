package com.EsiMediaG03.services;

import org.springframework.stereotype.Service;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.model.Contenido;

@Service
public class ContenidoService {

    private final ContenidoDAO contenidoDAO;

    public ContenidoService(ContenidoDAO contenidoDAO) {
        this.contenidoDAO = contenidoDAO;
    }

    public Contenido anadirContenido(Contenido contenido) throws Throwable {
        validarcontenido(contenido);
        return contenidoDAO.save(contenido);
    }

    private void validarcontenido(Contenido contenido) throws Throwable {
        if (contenido.getTipo() == null) {
            throw new IllegalArgumentException("El tipo de contenido debe ser AUDIO o VIDEO.");
        }

        if (contenido.getTipo() == Contenido.Tipo.AUDIO) {
            if (contenido.getFicheroAudio() == null || contenido.getFicheroAudio().isBlank()) {
                throw new IllegalArgumentException("Debe indicar la ruta del fichero de audio.");
            }
        } else if (contenido.getTipo() == Contenido.Tipo.VIDEO) {
            if (contenido.getUrlVideo() == null || contenido.getUrlVideo().isBlank()) {
                throw new IllegalArgumentException("Debe especificar una URL de vídeo.");
            }
            if (contenido.getResolucion() != null && !contenido.getResolucion().matches("(?i)^(720p|1080p|4k)$")) {
                throw new IllegalArgumentException("Resolución de vídeo no válida (solo 720p, 1080p, 4K).");
            }
            
        }

        if (contenido.getTitulo() == null || contenido.getTitulo().isBlank()) {
            throw new IllegalArgumentException("El título es obligatorio.");
        }

        if (contenido.getTags() == null || contenido.getTags().isEmpty()) {
            throw new IllegalArgumentException("Debe indicar al menos un tag.");
        }

        if (contenido.getDuracionMinutos() <= 0) {
            throw new IllegalArgumentException("La duración debe ser mayor a 0 minutos.");
        }
    }

}
