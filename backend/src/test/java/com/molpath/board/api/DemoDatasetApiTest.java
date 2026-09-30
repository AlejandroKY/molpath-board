package com.molpath.board.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.molpath.board.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/** El dataset demo compartido se siembra con su procedencia intacta. */
class DemoDatasetApiTest extends IntegrationTest {

    private static final String DEMO_001 = "20000000-0000-4000-8000-000000000001";

    @Test
    void demoCaseBoardContainsCaseKnowledgeAndReasoningLayers() throws Exception {
        String token = login(PATHOLOGY);
        JsonNode board = call("GET", "/api/cases/" + DEMO_001 + "/board", token, null).body();
        assertThat(board.path("caseRecord").path("caseCode").asString()).isEqualTo("DEMO-001");
        assertThat(board.path("caseRecord").path("demo").asBoolean()).isTrue();
        assertThat(board.path("ihc")).hasSize(4);
        assertThat(board.path("variants").findValuesAsString("proteinChange")).contains("L858R", "R273H");
        assertThat(board.path("evidence").findValuesAsString("externalId")).contains("EID347", "EID397", "EID7530");
        assertThat(board.path("evidence").findValuesAsString("pubmedUrl"))
                .contains("https://pubmed.ncbi.nlm.nih.gov/24662454/");
        assertThat(board.path("pathways").findValuesAsString("externalId")).contains("R-HSA-177929");
        assertThat(board.path("sourceVersions").findValuesAsString("versionLabel")).contains("Reactome v97");
        assertThat(board.path("interpretations")).hasSize(1);
        assertThat(board.path("commentCounts").size()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void searchDistinguishesEntityTypes() throws Exception {
        String token = login(PATHOLOGY);
        JsonNode ihc = call("GET", "/api/search?q=PD-L1", token, null).body();
        assertThat(ihc.path("groups").findValuesAsString("kind")).contains("IHC_MARKER");

        JsonNode tumor = call("GET", "/api/search?q=adenocarcinoma pulmonar", token, null).body();
        assertThat(tumor.path("groups").findValuesAsString("kind")).contains("CASE");

        JsonNode braf = call("GET", "/api/search?q=BRAF V600E", token, null).body();
        assertThat(braf.toString()).contains("DEMO-003");

        JsonNode pmid = call("GET", "/api/search?q=PMID: 24662454", token, null).body();
        assertThat(pmid.path("groups").path(0).path("kind").asString()).isEqualTo("PMID");
        assertThat(pmid.toString()).contains("Relationship between EGFR expression");
    }

    @Test
    void dashboardAndPaginationWork() throws Exception {
        String token = login(PATHOLOGY);
        JsonNode dashboard = call("GET", "/api/dashboard", token, null).body();
        assertThat(dashboard.path("counts").path("cases").asLong()).isGreaterThanOrEqualTo(3);
        JsonNode page = call("GET", "/api/cases?size=2&page=0", token, null).body();
        assertThat(page.path("items")).hasSize(2);
        assertThat(page.path("size").asInt()).isEqualTo(2);
        JsonNode capped = call("GET", "/api/evidence?size=5000", token, null).body();
        assertThat(capped.path("size").asInt()).isEqualTo(100);
    }

    @Test
    void longitudinalCaseHasTwoSamplesAndTimeline() throws Exception {
        String token = login(PATHOLOGY);
        String demo002 = "20000000-0000-4000-8000-000000000002";
        JsonNode board = call("GET", "/api/cases/" + demo002 + "/board", token, null).body();
        assertThat(board.path("samples")).hasSize(2);
        assertThat(board.path("variants").findValuesAsString("proteinChange")).contains("L858R", "T790M");
        JsonNode timeline = call("GET", "/api/cases/" + demo002 + "/timeline", token, null).body();
        assertThat(timeline.findValuesAsString("eventType")).contains("PROGRESSION", "METASTASIS");
    }
}
