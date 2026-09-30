package com.molpath.board.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.molpath.board.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Flujo mínimo exigido: crear caso → añadir muestra → añadir IHQ → añadir estudio molecular →
 * añadir variante → verla en la pizarra → crear snapshot (y verificar su integridad).
 */
class ClinicalFlowApiTest extends IntegrationTest {

    @Test
    void completeClinicalFlowEndsInAVerifiableSnapshot() throws Exception {
        String token = login(MOLECULAR);

        Response createdCase = call("POST", "/api/cases", token, Map.of(
                "caseCode", "test-flow-001", "organ", "Pulmón", "tumorType", "Adenocarcinoma pulmonar",
                "diagnosis", "Caso ficticio de prueba"));
        assertThat(createdCase.status()).isEqualTo(201);
        assertThat(createdCase.body().path("caseCode").asString()).isEqualTo("TEST-FLOW-001");
        String caseId = createdCase.body().path("id").asString();

        Response sample = call("POST", "/api/cases/" + caseId + "/samples", token, Map.of(
                "label", "Biopsia 1", "sampleType", "BIOPSY", "collectionDate", "2026-01-10",
                "tumorCellularityPct", 40, "dnaAvailable", true, "dnaQuality", "GOOD"));
        assertThat(sample.status()).isEqualTo(201);
        String sampleId = sample.body().path("id").asString();

        Response ihc = call("POST", "/api/samples/" + sampleId + "/ihc", token, Map.of(
                "marker", "TTF-1", "result", "POSITIVE"));
        assertThat(ihc.status()).isEqualTo(201);

        Response test = call("POST", "/api/samples/" + sampleId + "/molecular-tests", token, Map.of(
                "testType", "NGS_DNA", "panelName", "Panel prueba", "genesAnalyzed", List.of("egfr", "TP53", "EGFR"),
                "limitOfDetectionPct", 5, "testDate", "2026-01-20"));
        assertThat(test.status()).isEqualTo(201);
        assertThat(test.body().path("genesAnalyzed")).hasSize(2);
        String testId = test.body().path("id").asString();

        Response variant = call("POST", "/api/molecular-tests/" + testId + "/variants", token, Map.of(
                "geneSymbol", "EGFR", "variantType", "SNV", "hgvsC", "c.2573T>G", "hgvsP", "p.Leu858Arg",
                "vaf", 32.5, "coverage", 1400, "origin", "SOMATIC"));
        assertThat(variant.status()).isEqualTo(201);
        assertThat(variant.body().path("proteinChange").asString()).isEqualTo("L858R");
        String variantId = variant.body().path("id").asString();

        Response board = call("GET", "/api/cases/" + caseId + "/board", token, null);
        assertThat(board.status()).isEqualTo(200);
        JsonNode b = board.body();
        assertThat(b.path("schemaVersion").asInt()).isEqualTo(1);
        assertThat(b.path("samples")).hasSize(1);
        assertThat(b.path("ihc")).hasSize(1);
        assertThat(b.path("variants")).hasSize(1);
        assertThat(b.path("variants").path(0).path("id").asString()).isEqualTo(variantId);
        assertThat(b.path("genes").findValuesAsString("symbol")).contains("EGFR");

        Response snapshot = call("POST", "/api/cases/" + caseId + "/snapshots", token, Map.of(
                "label", "Snapshot inicial", "note", "Estado tras el primer NGS",
                "graphState", Map.of("collapsed", List.of("sample:" + sampleId))));
        assertThat(snapshot.status()).isEqualTo(201);
        assertThat(snapshot.body().path("contentSha256").asString()).hasSize(64);

        Response detail = call("GET", "/api/snapshots/" + snapshot.body().path("id").asString(), token, null);
        assertThat(detail.status()).isEqualTo(200);
        assertThat(detail.body().path("integrityVerified").asBoolean()).isTrue();
        assertThat(detail.body().path("content").path("board").path("variants")).hasSize(1);
        assertThat(detail.body().path("content").path("graphState").path("collapsed")).hasSize(1);

        Response timeline = call("GET", "/api/cases/" + caseId + "/timeline", token, null);
        assertThat(timeline.body().findValuesAsString("kind")).contains("SAMPLE", "MOLECULAR_TEST", "SNAPSHOT");

        Response search = call("GET", "/api/search?q=EGFR L858R", token, null);
        assertThat(search.status()).isEqualTo(200);
        assertThat(search.body().path("interpretedAs").path(0).asString()).isEqualTo("VARIANT");
        assertThat(search.body().toString()).contains(variantId);
    }

    @Test
    void discussionKeepsEditHistoryAndOnlyAuthorCanEdit() throws Exception {
        String pathologist = login(PATHOLOGY);
        String oncologist = login(ONCOLOGY);
        String caseId = "20000000-0000-4000-8000-000000000001";

        Response comment = call("POST", "/api/cases/" + caseId + "/comments", pathologist, Map.of(
                "targetType", "CASE", "targetId", caseId, "body", "Primera versión"));
        assertThat(comment.status()).isEqualTo(201);
        assertThat(comment.body().path("authorRole").asString()).isEqualTo("PATHOLOGY");
        String commentId = comment.body().path("id").asString();

        Response forbidden = call("PUT", "/api/comments/" + commentId, oncologist, Map.of("body", "No es mío"));
        assertThat(forbidden.status()).isEqualTo(403);

        Response edited = call("PUT", "/api/comments/" + commentId, pathologist, Map.of("body", "Segunda versión"));
        assertThat(edited.status()).isEqualTo(200);
        assertThat(edited.body().path("editedAt").isNull()).isFalse();

        Response revisions = call("GET", "/api/comments/" + commentId + "/revisions", pathologist, null);
        assertThat(revisions.body()).hasSize(1);
        assertThat(revisions.body().path(0).path("body").asString()).isEqualTo("Primera versión");
    }

    @Test
    void commentTargetMustBelongToTheCase() throws Exception {
        String token = login(PATHOLOGY);
        String case1 = "20000000-0000-4000-8000-000000000001";
        String sampleOfCase2 = "21000000-0000-4000-8000-000000000002";
        Response response = call("POST", "/api/cases/" + case1 + "/comments", token, Map.of(
                "targetType", "SAMPLE", "targetId", sampleOfCase2, "body", "Comentario"));
        assertThat(response.status()).isEqualTo(422);
    }

    @Test
    void interpretationsAreSupersededNotOverwritten() throws Exception {
        String token = login(MOLECULAR);
        String caseId = "20000000-0000-4000-8000-000000000003";
        Response first = call("POST", "/api/cases/" + caseId + "/interpretations", token, Map.of(
                "targetType", "CASE", "targetId", caseId, "statement", "Interpretación v1 (prueba)",
                "certainty", "LIMITED"));
        assertThat(first.status()).isEqualTo(201);
        Response second = call("POST", "/api/cases/" + caseId + "/interpretations", token, Map.of(
                "targetType", "CASE", "targetId", caseId, "statement", "Interpretación v2 (prueba)",
                "certainty", "MODERATE", "supersedesId", first.body().path("id").asString()));
        assertThat(second.status()).isEqualTo(201);

        Response list = call("GET", "/api/cases/" + caseId + "/interpretations", token, null);
        assertThat(list.body().findValuesAsString("status")).contains("SUPERSEDED", "CURRENT");
    }
}
