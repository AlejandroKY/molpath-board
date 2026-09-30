package com.molpath.board.common;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Sanitización de texto libre. React escapa la salida, así que aquí no se codifica HTML:
 * se normaliza Unicode, se eliminan caracteres de control y se recorta.
 * Para contenido de fuentes externas se eliminan además las etiquetas HTML.
 */
public final class Text {

    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");
    private static final Pattern TAGS = Pattern.compile("<[^>]{0,500}>");

    private Text() {
    }

    /** Devuelve el texto limpio o {@code null} si queda vacío. */
    public static String clean(String value) {
        if (value == null) {
            return null;
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFC);
        String stripped = CONTROL.matcher(normalized).replaceAll("").strip();
        return stripped.isEmpty() ? null : stripped;
    }

    /** Limpia y elimina marcado HTML (p. ej. resaltados devueltos por Reactome). */
    public static String stripHtml(String value) {
        if (value == null) {
            return null;
        }
        String noTags = TAGS.matcher(value).replaceAll("");
        String unescaped = noTags.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
                .replace("&#39;", "'").replace("&nbsp;", " ").replace("&amp;", "&");
        return clean(unescaped);
    }

    public static String upper(String value) {
        String cleaned = clean(value);
        return cleaned == null ? null : cleaned.toUpperCase(Locale.ROOT);
    }

    public static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max - 1) + "…";
    }
}
