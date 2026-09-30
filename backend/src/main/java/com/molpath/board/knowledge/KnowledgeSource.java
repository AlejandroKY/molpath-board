package com.molpath.board.knowledge;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Catálogo de fuentes (sembrado por Flyway). */
@Entity
@Table(name = "knowledge_source")
public class KnowledgeSource {

    @Id
    @Column(length = 32)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "homepage_url", length = 500)
    private String homepageUrl;

    @Column(name = "license_note")
    private String licenseNote;

    protected KnowledgeSource() {
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getHomepageUrl() {
        return homepageUrl;
    }

    public String getLicenseNote() {
        return licenseNote;
    }
}
