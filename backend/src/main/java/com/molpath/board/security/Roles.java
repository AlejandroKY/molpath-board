package com.molpath.board.security;

/**
 * Matriz de permisos (expresiones para {@code @PreAuthorize}).
 * <ul>
 *   <li>Lectura: cualquier usuario autenticado.</li>
 *   <li>Datos clínicos del caso (caso, muestra, histología, IHQ, estudios, variantes): disciplinas de laboratorio y ADMIN.</li>
 *   <li>Conocimiento (importar/enlazar/clasificar evidencia), interpretación, comentarios y snapshots: cualquier rol.</li>
 * </ul>
 */
public final class Roles {

    public static final String CLINICAL_EDITOR =
            "hasAnyRole('PATHOLOGY','MOLECULAR_BIOLOGY','GENETICS','BIOINFORMATICS','ADMIN')";

    public static final String CONTRIBUTOR = "isAuthenticated()";

    public static final String ADMIN = "hasRole('ADMIN')";

    private Roles() {
    }
}
