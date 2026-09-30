package com.molpath.board;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * MolPath Board: herramienta de apoyo informativo y de investigación.
 * No sustituye el juicio clínico profesional.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class MolPathApplication {

    public static void main(String[] args) {
        SpringApplication.run(MolPathApplication.class, args);
    }
}
