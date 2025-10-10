package com.example.usersbe.services;

import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CaptchaService {

    private static final int CODE_LEN = 6;
    private static final int EXPIRE_SECONDS = 120;

    private static final int IMG_W = 220;
    private static final int IMG_H = 60;

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final Font CODE_FONT = new Font("Arial", Font.BOLD, 40);

    private static final int NOISE_LINES = 22;
    private static final int NOISE_DOTS  = 160;

    private static class Entry {
        final String code;
        final Instant expiresAt;
        Entry(String code, Instant expiresAt) { this.code = code; this.expiresAt = expiresAt; }
        boolean expired() { return Instant.now().isAfter(expiresAt); }
    }

    private final Map<String, Entry> store = new ConcurrentHashMap<>();
    private final SecureRandom rnd = new SecureRandom();

    public static class CaptchaPayload {
        public final String token;
        public final String imageBase64;
        CaptchaPayload(String token, String imageBase64) {
            this.token = token;
            this.imageBase64 = imageBase64;
        }
    }

    public CaptchaPayload generate() {
        cleanupExpired(); 
        final String code  = randomCode(CODE_LEN);
        final String token = UUID.randomUUID().toString();

        store.put(token, new Entry(code, Instant.now().plusSeconds(EXPIRE_SECONDS)));

        final String b64 = renderPngBase64(code);
        return new CaptchaPayload(token, b64);
    }

    public boolean verifyAndConsume(String token, String answer) {
        cleanupExpired(); 
        if (token == null || answer == null) return false;

        final Entry e = store.remove(token); 
        if (e == null || e.expired()) return false;

        final String user = answer.trim();
        return e.code.equalsIgnoreCase(user);
    }

    private void cleanupExpired() {
        final Instant now = Instant.now();
        store.entrySet().removeIf(en -> en.getValue() == null || now.isAfter(en.getValue().expiresAt));
    }

    private String randomCode(int len) {
        final StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(ALPHABET.charAt(rnd.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    private String renderPngBase64(String code) {
        final BufferedImage img = new BufferedImage(IMG_W, IMG_H, BufferedImage.TYPE_INT_RGB);
        final Graphics2D g = img.createGraphics();

        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

        g.setColor(new Color(28, 28, 28));
        g.fillRect(0, 0, IMG_W, IMG_H);

        for (int i = 0; i < NOISE_LINES; i++) {
            g.setColor(new Color(60 + rnd.nextInt(90), 60 + rnd.nextInt(90), 60 + rnd.nextInt(90)));
            final int x1 = rnd.nextInt(IMG_W);
            final int y1 = rnd.nextInt(IMG_H);
            final int x2 = rnd.nextInt(IMG_W);
            final int y2 = rnd.nextInt(IMG_H);
            g.drawLine(x1, y1, x2, y2);
        }

        g.setFont(CODE_FONT);
        g.setColor(new Color(230, 230, 230));
        final FontMetrics fm = g.getFontMetrics();
        int x = 18;
        final int baseline = (IMG_H - fm.getHeight()) / 2 + fm.getAscent();

        for (char ch : code.toCharArray()) {
            final AffineTransform old = g.getTransform();
            final double angle = (rnd.nextDouble() - 0.5) * 0.6;     
            final double scale = 0.85 + rnd.nextDouble() * 0.35;     

            g.rotate(angle, x, baseline);
            g.scale(scale, scale);
            g.drawString(String.valueOf(ch), x, baseline);
            g.setTransform(old);

            x += fm.charWidth(ch) + 8;
        }

        for (int i = 0; i < NOISE_DOTS; i++) {
            g.setColor(new Color(110 + rnd.nextInt(120), 110 + rnd.nextInt(120), 110 + rnd.nextInt(120)));
            img.setRGB(rnd.nextInt(IMG_W), rnd.nextInt(IMG_H), g.getColor().getRGB());
        }

        g.dispose();

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", baos);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            throw new IllegalStateException("CAPTCHA render error", e);
        }
    }
}
