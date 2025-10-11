package com.example.usersbe.services;

import java.io.File;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender; // constructor injection (S6813 ok)

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendMail(String to, String subject, String htmlContent) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom("esimedia2025@gmail.com");
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlContent, true);

        // 1) Intento desde el classpath (src/main/resources/static/fotos/EsiMedia_Logo.png)
        Resource logo = new ClassPathResource("static/fotos/EsiMedia_Logo.png");

        // 2) Fallback a la ruta de fichero anterior si no está en el classpath
        if (!logo.exists()) {
            File logoFile = new File("Proyecto_Integrado_Programa/usersbe/src/main/resources/static/fotos/EsiMedia_Logo.png");
            if (logoFile.exists() && logoFile.isFile()) {
                logo = new FileSystemResource(logoFile);
            }
        }

        if (logo.exists()) {
            helper.addInline("logoEsiMedia", logo);
        } else {
            log.warn("Logo no encontrado en classpath ni en ruta alternativa. Se enviará el correo sin logo.");
        }

        mailSender.send(message);
    }
}
