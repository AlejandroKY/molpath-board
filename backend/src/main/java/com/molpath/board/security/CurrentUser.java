package com.molpath.board.security;

import com.molpath.board.user.AppUser;
import com.molpath.board.user.AppUserRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/** Acceso al usuario autenticado a partir del JWT del contexto de seguridad. */
@Component
public class CurrentUser {

    private final AppUserRepository users;

    public CurrentUser(AppUserRepository users) {
        this.users = users;
    }

    public Optional<UUID> id() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            try {
                return Optional.of(UUID.fromString(jwt.getSubject()));
            } catch (IllegalArgumentException e) {
                return Optional.empty();
            }
        }
        return Optional.empty();
    }

    /** Usuario autenticado y activo; lanza 403 si el token no corresponde a un usuario existente. */
    public AppUser require() {
        return id().flatMap(users::findById)
                .filter(AppUser::isActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                        "Usuario no reconocido"));
    }
}
