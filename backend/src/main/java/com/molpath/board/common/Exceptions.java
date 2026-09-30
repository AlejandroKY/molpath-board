package com.molpath.board.common;

/** Excepciones de dominio traducidas a HTTP por {@link GlobalExceptionHandler}. */
public final class Exceptions {

    private Exceptions() {
    }

    /** 404. */
    public static class NotFoundException extends RuntimeException {
        public NotFoundException(String entity, Object id) {
            super(entity + " no encontrado: " + id);
        }
    }

    /** 422: violación de una regla de dominio (p. ej. certeza sin base declarada). */
    public static class BusinessRuleException extends RuntimeException {
        public BusinessRuleException(String message) {
            super(message);
        }
    }

    /** 409: duplicado o modificación concurrente. */
    public static class ConflictException extends RuntimeException {
        public ConflictException(String message) {
            super(message);
        }
    }

    /** 403: la acción no está permitida para este usuario sobre este recurso. */
    public static class ForbiddenException extends RuntimeException {
        public ForbiddenException(String message) {
            super(message);
        }
    }

    /** 502: error al consultar una fuente externa. Nunca se sustituye por datos inventados. */
    public static class ExternalServiceException extends RuntimeException {
        private final String sourceCode;

        public ExternalServiceException(String sourceCode, String message, Throwable cause) {
            super(message, cause);
            this.sourceCode = sourceCode;
        }

        public ExternalServiceException(String sourceCode, String message) {
            this(sourceCode, message, null);
        }

        public String getSourceCode() {
            return sourceCode;
        }
    }

    /** 503: el proveedor existe pero está desactivado (configuración o licencia). */
    public static class ProviderUnavailableException extends RuntimeException {
        public ProviderUnavailableException(String sourceCode, String reason) {
            super(sourceCode + ": " + reason);
        }
    }
}
