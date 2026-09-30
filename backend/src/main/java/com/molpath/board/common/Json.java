package com.molpath.board.common;

import tools.jackson.databind.JsonNode;

/** Lectura defensiva de nodos JSON de fuentes externas. */
public final class Json {

    private Json() {
    }

    public static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.path(field);
        if (value == null || value.isMissingNode() || value.isNull()) {
            return null;
        }
        String text = value.asString();
        return text == null || text.isBlank() ? null : text;
    }

    public static Integer integer(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.path(field);
        if (value == null || value.isMissingNode() || value.isNull()) {
            return null;
        }
        if (value.isNumber()) {
            return value.asInt();
        }
        try {
            return Integer.valueOf(value.asString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
