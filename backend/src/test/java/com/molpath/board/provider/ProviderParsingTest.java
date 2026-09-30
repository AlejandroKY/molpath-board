package com.molpath.board.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import com.molpath.board.knowledge.KnowledgeEnums.InterpretationScope;
import com.molpath.board.provider.ProviderContracts.ClinVarRecord;
import com.molpath.board.provider.ProviderContracts.EvidenceCandidate;
import com.molpath.board.provider.ProviderContracts.PublicationRecord;
import com.molpath.board.provider.civic.CivicMapper;
import com.molpath.board.provider.clinvar.ClinVarProvider;
import com.molpath.board.provider.pubmed.PubMedXmlParser;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.json.JsonMapper;

/** Parsers de fuentes externas probados con fixtures reales (sin red). */
class ProviderParsingTest {

    private final JsonMapper json = JsonMapper.builder().build();

    private static String fixture(String name) throws IOException {
        try (InputStream in = ProviderParsingTest.class.getResourceAsStream("/fixtures/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    void pubmedXmlIsParsedWithPmidDoiAuthorsAndStructuredAbstract() throws IOException {
        List<PublicationRecord> records = PubMedXmlParser.parse(fixture("pubmed-efetch-24662454.xml"));
        assertThat(records).hasSize(1);
        PublicationRecord r = records.getFirst();
        assertThat(r.pmid()).isEqualTo("24662454");
        assertThat(r.doi()).isEqualTo("10.1097/JTO.0000000000000141");
        assertThat(r.title()).startsWith("Relationship between EGFR expression");
        assertThat(r.journal()).isEqualTo("J Thorac Oncol");
        assertThat(r.pubYear()).isEqualTo(2014);
        assertThat(r.pubDate()).isEqualTo("2014 May");
        assertThat(r.authors()).startsWith("Douillard JY, Pirker R").endsWith("et al.");
        assertThat(r.abstractText()).contains("INTRODUCTION: ").contains("CONCLUSIONS: ");
    }

    @Test
    void pubmedParserRejectsExternalEntities() {
        String xxe = """
                <?xml version="1.0"?>
                <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
                <PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>1</PMID>
                <Article><ArticleTitle>&xxe;</ArticleTitle></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>
                """;
        // Con entidades externas desactivadas, el parser no resuelve la entidad: o falla o la deja vacía.
        try {
            List<PublicationRecord> records = PubMedXmlParser.parse(xxe);
            assertThat(records.getFirst().title()).isNull();
        } catch (IllegalArgumentException expected) {
            assertThat(expected).hasMessageContaining("XML");
        }
    }

    @Test
    void pubmedParserRejectsMalformedXml() {
        assertThatThrownBy(() -> PubMedXmlParser.parse("<no-cerrado>")).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @CsvSource({"A, STRONG", "B, MODERATE", "C, LIMITED", "D, LIMITED", "E, INSUFFICIENT", "Z, UNKNOWN"})
    void civicLevelMappingIsTheDocumentedRule(String level, Certainty expected) {
        assertThat(CivicMapper.certaintyForLevel(level)).isEqualTo(expected);
    }

    @Test
    void civicEvidenceItemIsMappedPreservingOriginalLevelAndDirection() throws IOException {
        EvidenceCandidate c = CivicMapper.toCandidate(json.readTree(fixture("civic-eid347.json")));
        assertThat(c).isNotNull();
        assertThat(c.externalId()).isEqualTo("EID347");
        assertThat(c.geneSymbol()).isEqualTo("EGFR");
        assertThat(c.variantDescriptor()).isEqualTo("L858R");
        assertThat(c.evidenceType()).isEqualTo(EvidenceType.PROGNOSTIC);
        assertThat(c.sourceLevel()).isEqualTo("B");
        assertThat(c.sourceDirection()).isEqualTo("SUPPORTS");
        assertThat(c.mappedCertainty()).isEqualTo(Certainty.MODERATE);
        assertThat(c.interpretationScope()).isEqualTo(InterpretationScope.SOMATIC);
        assertThat(c.pmid()).isEqualTo("24662454");
        assertThat(c.url()).isEqualTo("https://civicdb.org/evidence/347/summary");
    }

    @Test
    void clinvarKeepsGermlineAndSomaticClassificationsSeparate() throws IOException {
        List<ClinVarRecord> records = ClinVarProvider.parseSummaries(
                json.readTree(fixture("clinvar-esummary-16609.json")).path("result"));
        assertThat(records).hasSize(1);
        ClinVarRecord r = records.getFirst();
        assertThat(r.accession()).isEqualTo("VCV000016609");
        assertThat(r.url()).isEqualTo("https://www.ncbi.nlm.nih.gov/clinvar/variation/16609/");
        assertThat(r.germline().description()).isEqualTo("drug response");
        assertThat(r.somaticClinicalImpact().description()).isEqualTo("Tier I - Strong");
        assertThat(r.oncogenicity().description()).isEqualTo("Oncogenic");
        assertThat(r.germline().reviewStatus()).isEqualTo("reviewed by expert panel");
    }
}
