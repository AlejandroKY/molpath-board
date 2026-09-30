package com.molpath.board.audit;

import com.molpath.board.security.CurrentUser;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Registro de auditoría: quién cambió qué y cuál era el estado anterior.
 * Se ejecuta dentro de la transacción del cambio: si el cambio falla, no queda rastro falso.
 */
@Service
public class AuditService {

    public static final String CREATE = "CREATE";
    public static final String UPDATE = "UPDATE";
    public static final String DELETE = "DELETE";
    public static final String LINK = "LINK";
    public static final String UNLINK = "UNLINK";
    public static final String IMPORT = "IMPORT";

    private final AuditEventRepository repository;
    private final ObjectMapper objectMapper;
    private final CurrentUser currentUser;

    public AuditService(AuditEventRepository repository, ObjectMapper objectMapper, CurrentUser currentUser) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.currentUser = currentUser;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String action, String entityType, Object entityId, UUID caseId, Object before, Object after) {
        repository.save(new AuditEvent(currentUser.id().orElse(null), action, entityType, String.valueOf(entityId),
                caseId, toJson(before), toJson(after)));
    }

    private String toJson(Object state) {
        return state == null ? null : objectMapper.writeValueAsString(state);
    }
}
