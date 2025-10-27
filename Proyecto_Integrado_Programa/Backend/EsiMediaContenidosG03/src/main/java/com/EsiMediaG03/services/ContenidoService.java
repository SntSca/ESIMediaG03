package com.EsiMediaG03.services;

import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.stereotype.Service;

import com.EsiMediaG03.dao.ContenidoDAO;
import com.EsiMediaG03.dto.StreamingTarget;
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

    public StreamingTarget resolveStreamingTarget(String id) throws Exception {
        Contenido c = contenidoDAO.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contenido no encontrado: " + id));

        // Reglas mínimas para esta HU: solo reproducible (visible true opcional)
        // Si quieres, descomenta esta validación de visibilidad:
        // if (!c.isVisible()) throw new IllegalStateException("Contenido no visible.");

        if (c.getTipo() == null) throw new IllegalArgumentException("Tipo de contenido no definido.");

        switch (c.getTipo()) {
            case AUDIO -> {
                String pathStr = c.getFicheroAudio();
                if (pathStr == null || pathStr.isBlank()) {
                    throw new IllegalArgumentException("AUDIO sin ficheroAudio.");
                }
                Path path = Path.of(pathStr);
                if (!Files.exists(path) || !Files.isReadable(path)) {
                    throw new IllegalStateException("Fichero de audio no accesible: " + path);
                }
                long length = Files.size(path);
                String mime = guessMimeFromExt(pathStr, "audio/mpeg");
                return StreamingTarget.local(path, length, mime);
            }
            case VIDEO -> {
                String urlOrPath = c.getUrlVideo();
                if (urlOrPath == null || urlOrPath.isBlank()) {
                    throw new IllegalArgumentException("VIDEO sin urlVideo o ruta local.");
                }
                if (isHttp(urlOrPath)) {
                    // Vídeo externo → redirección
                    return StreamingTarget.external(urlOrPath, "video/mp4");
                } else {
                    // Vídeo local (ruta en disco)
                    Path path = Path.of(urlOrPath);
                    if (!Files.exists(path) || !Files.isReadable(path)) {
                        throw new IllegalStateException("Fichero de vídeo no accesible: " + path);
                    }
                    long length = Files.size(path);
                    String mime = guessMimeFromExt(urlOrPath, "video/mp4");
                    return StreamingTarget.local(path, length, mime);
                }
            }
            default -> throw new IllegalArgumentException("Tipo no soportado.");
        }
    }

    private boolean isHttp(String s) {
        String l = s.toLowerCase();
        return l.startsWith("http://") || l.startsWith("https://");
    }

    private String guessMimeFromExt(String path, String fallback) {
        String l = path.toLowerCase();
        if (l.endsWith(".mp3")) return "audio/mpeg";
        if (l.endsWith(".wav")) return "audio/wav";
        if (l.endsWith(".m4a")) return "audio/mp4";
        if (l.endsWith(".flac")) return "audio/flac";
        if (l.endsWith(".mp4")) return "video/mp4";
        if (l.endsWith(".webm")) return "video/webm";
        if (l.endsWith(".mkv")) return "video/x-matroska";
        return fallback;
    }

    private void validarcontenido(Contenido contenido) throws Throwable {
        validarTipoContenido(contenido);
        validarTituloYTags(contenido);
        validarDuracion(contenido);
    }

    private void validarTipoContenido(Contenido contenido) {
        if (contenido.getTipo() == null) {
            throw new IllegalArgumentException("El tipo de contenido debe ser AUDIO o VIDEO.");
        }

        if (contenido.getTipo() == Contenido.Tipo.AUDIO) {
            validarFicheroAudio(contenido);
        } else if (contenido.getTipo() == Contenido.Tipo.VIDEO) {
            validarVideo(contenido);
        }
    }

    private void validarFicheroAudio(Contenido contenido) {
        if (contenido.getFicheroAudio() == null || contenido.getFicheroAudio().isBlank()) {
            throw new IllegalArgumentException("Debe indicar la ruta del fichero de audio.");
        }
    }

    private void validarVideo(Contenido contenido) {
        if (contenido.getUrlVideo() == null || contenido.getUrlVideo().isBlank()) {
            throw new IllegalArgumentException("Debe especificar una URL de vídeo.");
        }
        if (contenido.getResolucion() != null && !contenido.getResolucion().matches("(?i)^(720p|1080p|4k)$")) {
            throw new IllegalArgumentException("Resolución de vídeo no válida (solo 720p, 1080p, 4K).");
        }
    }

    private void validarTituloYTags(Contenido contenido) {
        if (contenido.getTitulo() == null || contenido.getTitulo().isBlank()) {
            throw new IllegalArgumentException("El título es obligatorio.");
        }

        if (contenido.getTags() == null || contenido.getTags().isEmpty()) {
            throw new IllegalArgumentException("Debe indicar al menos un tag.");
        }
    }

    private void validarDuracion(Contenido contenido) {
        if (contenido.getDuracionMinutos() <= 0) {
            throw new IllegalArgumentException("La duración debe ser mayor a 0 minutos.");
        }
    }

}
