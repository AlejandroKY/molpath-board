package com.molpath.board.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI molPathOpenApi(AppProperties properties) {
        return new OpenAPI()
                .info(new Info()
                        .title(properties.app().name() + " API")
                        .version("0.1.0")
                        .description("""
                                API REST para organizar y visualizar información de anatomía patológica, \
                                inmunohistoquímica y biología molecular tumoral con trazabilidad científica. \
                                Herramienta de apoyo informativo y de investigación. \
                                No sustituye el juicio clínico profesional."""))
                .components(new Components().addSecuritySchemes("bearer-jwt",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearer-jwt"));
    }
}
