package com.molpath.board.user;

import java.util.UUID;

public record UserSummary(UUID id, String username, String displayName, UserRole role, String roleLabel) {

    public static UserSummary from(AppUser user) {
        return user == null ? null
                : new UserSummary(user.getId(), user.getUsername(), user.getDisplayName(), user.getRole(),
                        user.getRole().label());
    }
}
