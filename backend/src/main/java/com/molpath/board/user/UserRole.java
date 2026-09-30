package com.molpath.board.user;

/** Disciplina del usuario; se usa también como autoridad de seguridad (ADR-008). */
public enum UserRole {
    PATHOLOGY("Patología"),
    MOLECULAR_BIOLOGY("Biología Molecular"),
    ONCOLOGY("Oncología"),
    GENETICS("Genética"),
    BIOINFORMATICS("Bioinformática"),
    RESEARCHER("Investigador"),
    ADMIN("Administrador");

    private final String label;

    UserRole(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
