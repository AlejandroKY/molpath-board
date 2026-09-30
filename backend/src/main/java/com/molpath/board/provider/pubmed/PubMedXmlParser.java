package com.molpath.board.provider.pubmed;

import com.molpath.board.common.Text;
import com.molpath.board.provider.ProviderContracts.PublicationRecord;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

/**
 * Convierte la respuesta XML de {@code efetch.fcgi?db=pubmed} en registros de publicación.
 * El parser deshabilita DTD externos y entidades externas (prevención de XXE).
 */
public final class PubMedXmlParser {

    private static final int MAX_AUTHORS = 6;
    private static final Pattern YEAR = Pattern.compile("(\\d{4})");

    private PubMedXmlParser() {
    }

    public static List<PublicationRecord> parse(String xml) {
        Document document = secureParse(xml);
        NodeList articles = document.getElementsByTagName("PubmedArticle");
        List<PublicationRecord> records = new ArrayList<>();
        for (int i = 0; i < articles.getLength(); i++) {
            records.add(toRecord((Element) articles.item(i)));
        }
        return records;
    }

    private static PublicationRecord toRecord(Element article) {
        Element citation = first(article, "MedlineCitation");
        String pmid = text(first(citation, "PMID"));
        Element art = first(citation, "Article");
        String title = text(first(art, "ArticleTitle"));
        Element journal = first(art, "Journal");
        String journalName = text(first(journal, "ISOAbbreviation"));
        if (journalName == null) {
            journalName = text(first(journal, "Title"));
        }
        Element pubDateEl = first(first(journal, "JournalIssue"), "PubDate");
        String pubDate = formatPubDate(pubDateEl);
        Integer year = extractYear(pubDate);
        return new PublicationRecord(pmid, extractDoi(article, art), title, extractAuthors(art), journalName, year,
                pubDate, extractAbstract(art));
    }

    private static String extractAuthors(Element article) {
        Element list = first(article, "AuthorList");
        if (list == null) {
            return null;
        }
        NodeList authors = list.getElementsByTagName("Author");
        List<String> names = new ArrayList<>();
        for (int i = 0; i < authors.getLength() && names.size() < MAX_AUTHORS; i++) {
            Element author = (Element) authors.item(i);
            String collective = text(first(author, "CollectiveName"));
            if (collective != null) {
                names.add(collective);
                continue;
            }
            String last = text(first(author, "LastName"));
            String initials = text(first(author, "Initials"));
            if (last != null) {
                names.add(initials == null ? last : last + " " + initials);
            }
        }
        if (names.isEmpty()) {
            return null;
        }
        String joined = String.join(", ", names);
        return authors.getLength() > MAX_AUTHORS ? joined + ", et al." : joined;
    }

    private static String extractAbstract(Element article) {
        Element abs = first(article, "Abstract");
        if (abs == null) {
            return null;
        }
        NodeList parts = abs.getElementsByTagName("AbstractText");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.getLength(); i++) {
            Element part = (Element) parts.item(i);
            String label = part.getAttribute("Label");
            String content = text(part);
            if (content == null) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append("\n\n");
            }
            if (label != null && !label.isBlank()) {
                sb.append(label).append(": ");
            }
            sb.append(content);
        }
        return sb.isEmpty() ? null : sb.toString();
    }

    private static String extractDoi(Element pubmedArticle, Element article) {
        Element pubmedData = first(pubmedArticle, "PubmedData");
        if (pubmedData != null) {
            NodeList ids = pubmedData.getElementsByTagName("ArticleId");
            for (int i = 0; i < ids.getLength(); i++) {
                Element id = (Element) ids.item(i);
                if ("doi".equalsIgnoreCase(id.getAttribute("IdType"))) {
                    return text(id);
                }
            }
        }
        if (article != null) {
            NodeList locations = article.getElementsByTagName("ELocationID");
            for (int i = 0; i < locations.getLength(); i++) {
                Element loc = (Element) locations.item(i);
                if ("doi".equalsIgnoreCase(loc.getAttribute("EIdType"))) {
                    return text(loc);
                }
            }
        }
        return null;
    }

    private static String formatPubDate(Element pubDate) {
        if (pubDate == null) {
            return null;
        }
        String medline = text(first(pubDate, "MedlineDate"));
        if (medline != null) {
            return medline;
        }
        StringBuilder sb = new StringBuilder();
        for (String part : new String[] {"Year", "Month", "Day"}) {
            String value = text(first(pubDate, part));
            if (value != null) {
                if (!sb.isEmpty()) {
                    sb.append(' ');
                }
                sb.append(value);
            }
        }
        return sb.isEmpty() ? null : sb.toString();
    }

    private static Integer extractYear(String pubDate) {
        if (pubDate == null) {
            return null;
        }
        Matcher m = YEAR.matcher(pubDate);
        return m.find() ? Integer.valueOf(m.group(1)) : null;
    }

    private static Element first(Element parent, String tag) {
        if (parent == null) {
            return null;
        }
        for (Node child = parent.getFirstChild(); child != null; child = child.getNextSibling()) {
            if (child instanceof Element element && tag.equals(element.getTagName())) {
                return element;
            }
        }
        return null;
    }

    private static String text(Element element) {
        return element == null ? null : Text.clean(element.getTextContent().replaceAll("\\s+", " "));
    }

    static Document secureParse(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            factory.setNamespaceAware(false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            return builder.parse(new InputSource(new StringReader(xml)));
        } catch (Exception e) {
            throw new IllegalArgumentException("XML de PubMed no válido", e);
        }
    }
}
