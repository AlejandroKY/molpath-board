package com.molpath.board.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Los repositorios de cada módulo se agrupan como interfaces anidadas; hay que habilitar su detección. */
@Configuration
@EnableJpaRepositories(basePackages = "com.molpath.board", considerNestedRepositories = true)
public class JpaConfig {
}
