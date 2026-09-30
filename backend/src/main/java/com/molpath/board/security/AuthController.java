package com.molpath.board.security;

import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.config.AppProperties;
import com.molpath.board.user.AppUser;
import com.molpath.board.user.AppUserRepository;
import com.molpath.board.user.UserSummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticación")
public class AuthController {

    private final AppUserRepository users;
    private final JwtEncoder jwtEncoder;
    private final AppProperties properties;
    private final CurrentUser currentUser;

    public AuthController(AppUserRepository users, JwtEncoder jwtEncoder, AppProperties properties,
            CurrentUser currentUser) {
        this.users = users;
        this.jwtEncoder = jwtEncoder;
        this.properties = properties;
        this.currentUser = currentUser;
    }

    public record DevLoginRequest(@NotBlank @Size(max = 64) String username) {}

    public record TokenResponse(String token, Instant expiresAt, UserSummary user) {}

    @GetMapping("/dev-users")
    @Operation(summary = "Usuarios demo disponibles para el login de desarrollo (sólo si está habilitado)")
    public List<UserSummary> devUsers() {
        requireDevLogin();
        return users.findAllByActiveTrueOrderByRoleAscDisplayNameAsc().stream().map(UserSummary::from).toList();
    }

    @PostMapping("/dev-login")
    @Operation(summary = "Emite un JWT para un usuario demo. Desactivar en producción (MOLPATH_DEV_LOGIN_ENABLED=false)")
    public TokenResponse devLogin(@Valid @RequestBody DevLoginRequest request) {
        requireDevLogin();
        AppUser user = users.findByUsernameAndActiveTrue(request.username().trim())
                .orElseThrow(() -> new NotFoundException("Usuario", request.username()));
        Instant now = Instant.now();
        Instant expiresAt = now.plus(properties.security().jwtTtlMinutes(), ChronoUnit.MINUTES);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("molpath-board")
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim(SecurityConfig.ROLE_CLAIM, user.getRole().name())
                .claim("name", user.getDisplayName())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new TokenResponse(token, expiresAt, UserSummary.from(user));
    }

    @GetMapping("/me")
    @Operation(summary = "Usuario autenticado")
    public UserSummary me() {
        return UserSummary.from(currentUser.require());
    }

    private void requireDevLogin() {
        if (!properties.security().devLoginEnabled()) {
            throw new NotFoundException("Recurso", "dev-login");
        }
    }
}
