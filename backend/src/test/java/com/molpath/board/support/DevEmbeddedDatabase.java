package com.molpath.board.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.sql.DataSource;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** Desarrollo local: PostgreSQL embebido persistente en {@code backend/.data/pg} (puerto 54329). */
@TestConfiguration(proxyBeanMethods = false)
public class DevEmbeddedDatabase {

    @Bean
    EmbeddedPostgres embeddedPostgres() throws Exception {
        Path data = Path.of(".data", "pg");
        Files.createDirectories(data);
        return EmbeddedPg.start(data.toAbsolutePath(), 54329);
    }

    @Bean
    DataSource dataSource(EmbeddedPostgres postgres) {
        return postgres.getPostgresDatabase();
    }
}
