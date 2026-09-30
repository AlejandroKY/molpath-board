package com.molpath.board.common;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Persistable;

/**
 * Entidad con UUID asignado por la aplicación (permite ids estables entre backend,
 * dataset demo y snapshots). Implementa {@link Persistable} para que Spring Data
 * haga INSERT directo en lugar de SELECT + MERGE.
 */
@MappedSuperclass
public abstract class BaseEntity implements Persistable<UUID> {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Transient
    private boolean newEntity = true;

    protected BaseEntity() {
        // JPA
    }

    protected BaseEntity(UUID id) {
        this.id = id == null ? UUID.randomUUID() : id;
    }

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostLoad
    @PostPersist
    void markPersisted() {
        this.newEntity = false;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        return id != null && Objects.equals(id, ((BaseEntity) o).id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
