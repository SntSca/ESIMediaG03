package com.EsiMediaG03.services;

import java.util.List;
import java.util.NoSuchElementException;

import org.springframework.stereotype.Service;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.model.Contenido;
import com.EsiMediaG03.exception.ValidationException; // <-- Ajusta el paquete si es necesario

@Service
public class ContenidoService {

    private final ContenidoDAO contenidoDAO;

    public ContenidoService(ContenidoDAO contenidoDAO) {
        this.contenidoDAO = contenidoDAO;
    }

    public Contenido anadirContenido(Contenido contenido) {
        validarContenido(contenido);
        return contenidoDAO.save(contenido);
    }

    public Contenido modificarContenido(Contenido contenido) {
        if (contenido.getId() == null) {
            throw new ValidationException("El ID del contenido es obligatorio para modificar.");
        }

        contenidoDAO.findById(contenido.getId())
            .orElseThrow(() -> new NoSuchElementException("No existe contenido con ID: " + contenido.getId()));

        validarContenido(contenido);
        return contenidoDAO.save(contenido);
    }

    public List<Contenido> listarContenidos() {
        return contenidoDAO.findAll();
    }

    public List<Contenido> buscarPorTitulo(String titulo) {
        return contenidoDAO.findByTitulo(titulo);
    }

    public List<Contenido> listarVisibles(boolean esVip) {
        List<Contenido> visibles = contenidoDAO.findByVisibleTrue();
        if (!esVip) {
            visibles.removeIf(c -> c.isVip() || "4K".equalsIgnoreCase(c.getResolucion()));
        }
        return visibles;
    }

    public List<Contenido> buscarPorTags(List<String> tags) {
        return contenidoDAO.findByTagsIn(tags);
    }

    public List<Contenido> buscarPorTipo(Contenido.Tipo tipo) {
        return contenidoDAO.findByTipo(tipo);
    }

    public void eliminarContenido(String id) {
        if (!contenidoDAO.existsById(id)) {
            throw new NoSuchElementException("Contenido no existente");
        }
        contenidoDAO.deleteById(id);
    }

    // ==========================
    // Validaciones (baja complejidad)
    // ==========================
    private void validarContenido(Contenido contenido) {
        validarTipo(contenido);
        validarCamposPorTipo(contenido);
        validarTitulo(contenido);
        validarTags(contenido);
        validarDuracion(contenido);
        validarResolucionSiVideo(contenido);
    }

    private void validarTipo(Contenido contenido) {
        if (contenido.getTipo() == null) {
            throw new ValidationException("El tipo de contenido debe ser AUDIO o VIDEO.");
        }
    }

    private void validarCamposPorTipo(Contenido contenido) {
        if (contenido.getTipo() == Contenido.Tipo.AUDIO) {
            if (contenido.getFicheroAudio() == null || contenido.getFicheroAudio().isBlank()) {
                throw new ValidationException("Debe indicar la ruta del fichero de audio.");
            }
        } else if (contenido.getTipo() == Contenido.Tipo.VIDEO) {
            if (contenido.getUrlVideo() == null || contenido.getUrlVideo().isBlank()) {
                throw new ValidationException("Debe especificar una URL de vídeo.");
            }
        }
    }

    private void validarTitulo(Contenido contenido) {
        if (contenido.getTitulo() == null || contenido.getTitulo().isBlank()) {
            throw new ValidationException("El título es obligatorio.");
        }
    }

    private void validarTags(Contenido contenido) {
        if (contenido.getTags() == null || contenido.getTags().isEmpty()) {
            throw new ValidationException("Debe indicar al menos un tag.");
        }
    }

    private void validarDuracion(Contenido contenido) {
        if (contenido.getDuracionMinutos() <= 0) {
            throw new ValidationException("La duración debe ser mayor a 0 minutos.");
        }
    }

    private void validarResolucionSiVideo(Contenido contenido) {
        if (contenido.getTipo() == Contenido.Tipo.VIDEO && contenido.getResolucion() != null) {
            String resol = contenido.getResolucion();
            if (!resol.matches("(?i)^(720p|1080p|4k)$")) {
                throw new ValidationException("Resolución de vídeo no válida (solo 720p, 1080p, 4K).");
            }
        }
    }
}
