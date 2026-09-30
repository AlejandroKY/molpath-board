package com.molpath.board.provider;

import java.time.Duration;
import java.time.Instant;
import java.util.function.Supplier;

/** Caché mínima para etiquetas de versión de fuentes (evita consultarlas en cada importación). */
public final class VersionCache {

    private final Duration ttl;
    private String value;
    private Instant loadedAt = Instant.EPOCH;

    public VersionCache(Duration ttl) {
        this.ttl = ttl;
    }

    public synchronized String get(Supplier<String> loader) {
        if (value == null || Instant.now().isAfter(loadedAt.plus(ttl))) {
            value = loader.get();
            loadedAt = Instant.now();
        }
        return value;
    }
}
