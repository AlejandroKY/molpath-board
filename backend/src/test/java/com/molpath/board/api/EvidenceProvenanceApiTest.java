package com.molpath.board.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import com.molpath.board.knowledge.KnowledgeEnums.InterpretationScope;
import com.molpath.board.provider.ProviderContracts.EvidenceCandidate;
import com.molpath.board.provider.ProviderContracts.ProviderInfo;
import com.molpath.board.provider.ProviderContracts.ProviderStatus;
import com.molpath.board.provider.ProviderContracts.PublicationRecord;
import com.molpath.board.provider.civic.CivicProvider;
import com.molpath.board.provider.pubmed.PubMedProvider;
import com.molpath.board.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Trazabilidad de importaciones: el servidor vuelve a consultar la fuente, registra versión y fecha
 * de consulta, verifica el PMID y aplica el mapeo documentado de certeza. Las fuentes se simulan (sin red).
 */
class EvidenceProvenanceApiTest extends IntegrationTest {

    @MockitoBean
    PubMedProvider pubMed;

    @MockitoBean
    CivicProvider civic;

    @BeforeEach
    void stubProviders() {
        when(pubMed.info()).thenReturn(new ProviderInfo("PUBMED", "PubMed", "test", ProviderStatus.ENABLED, "", ""));
        when(pubMed.currentVersionLabel()).thenReturn("NCBI E-utilities (test)");
        when(pubMed.fetchByPmid(anyString())).thenReturn(Optional.empty());
        when(pubMed.fetchByPmid("11111111")).thenReturn(Optional.of(new PublicationRecord("11111111",
                "10.0000/test.fixture", "Título de publicación simulada para pruebas", "Autor A, Autor B",
                "Revista de Pruebas", 2020, "2020 Jan", null)));
        when(civic.info()).thenReturn(new ProviderInfo("CIVIC", "CIViC", "test", ProviderStatus.ENABLED, "", ""));
        when(civic.currentVersionLabel()).thenReturn("CIViC (test)");
        when(civic.fetchById("EID900001")).thenReturn(Optional.of(new EvidenceCandidate("CIVIC", "EID900001",
                "KRAS", "G12D", "KRAS G12D", EvidenceType.ONCOGENIC, "Descripción simulada para pruebas",
                "Test disease", "A", "SUPPORTS", "ONCOGENICITY", 4, List.of(), InterpretationScope.SOMATIC,
                Certainty.STRONG, "https://civicdb.org/evidence/900001/summary", "11111111", "Test et al.", 2020)));
    }

    @Test
    void unknownPmidIsNeverStored() throws Exception {
        String token = login(MOLECULAR);
        Response response = call("POST", "/api/publications/import", token, Map.of("pmid", "22222222"));
        assertThat(response.status()).isEqualTo(404);
        assertThat(call("GET", "/api/publications/22222222", token, null).status()).isEqualTo(404);
    }

    @Test
    void importingPublicationDerivesPubmedUrlAndRecordsVersion() throws Exception {
        String token = login(MOLECULAR);
        Response response = call("POST", "/api/publications/import", token, Map.of("pmid", "11111111"));
        assertThat(response.status()).isEqualTo(200);
        assertThat(response.body().path("pubmedUrl").asString()).isEqualTo("https://pubmed.ncbi.nlm.nih.gov/11111111/");
        assertThat(response.body().path("sourceVersionId").isNull()).isFalse();
        assertThat(response.body().path("retrievedAt").isNull()).isFalse();
    }

    @Test
    void importedEvidenceKeepsSourceLevelMappedCertaintyAndIsLinkedOnce() throws Exception {
        String token = login(MOLECULAR);
        String variantId = "25000000-0000-4000-8000-000000000006";
        Response imported = call("POST", "/api/external/evidence/import", token, Map.of(
                "source", "civic", "externalId", "EID900001", "variantId", variantId));
        assertThat(imported.status()).isEqualTo(200);
        assertThat(imported.body().path("sourceLevel").asString()).isEqualTo("A");
        assertThat(imported.body().path("certainty").asString()).isEqualTo("STRONG");
        assertThat(imported.body().path("certaintyBasis").asString()).isEqualTo("SOURCE_MAPPING");
        assertThat(imported.body().path("pmid").asString()).isEqualTo("11111111");
        assertThat(imported.body().path("sourceVersionLabel").asString()).isEqualTo("CIViC (test)");

        Response again = call("POST", "/api/external/evidence/import", token, Map.of(
                "source", "CIVIC", "externalId", "EID900001", "variantId", variantId));
        assertThat(again.body().path("id").asString()).isEqualTo(imported.body().path("id").asString());

        String evidenceId = imported.body().path("id").asString();
        Response reclassified = call("PUT", "/api/evidence/" + evidenceId + "/classification", token, Map.of(
                "certainty", "CONTRADICTORY", "status", "ACTIVE"));
        assertThat(reclassified.body().path("certaintyBasis").asString()).isEqualTo("USER_ASSIGNED");

        Response history = call("GET", "/api/evidence/" + evidenceId + "/history", token, null);
        assertThat(history.body().findValuesAsString("action")).containsExactly("IMPORT", "UPDATE");
    }

    @Test
    void oncoKbIsReportedAsPendingLicenseReview() throws Exception {
        String token = login(MOLECULAR);
        Response providers = call("GET", "/api/external/providers", token, null);
        assertThat(providers.body().toString()).contains("LICENSE_REVIEW_REQUIRED");
        Response search = call("GET", "/api/external/evidence?source=ONCOKB&gene=EGFR&variant=L858R", token, null);
        assertThat(search.status()).isEqualTo(503);
    }
}
