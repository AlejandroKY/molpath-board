package com.molpath.board.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.molpath.board.support.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SecurityAndValidationApiTest extends IntegrationTest {

    @Test
    void apiRequiresAuthentication() throws Exception {
        assertThat(call("GET", "/api/cases", null, null).status()).isEqualTo(401);
        assertThat(call("GET", "/api/cases", "token-invalido", null).status()).isEqualTo(401);
    }

    @Test
    void devUsersAreListedWhenDevLoginIsEnabled() throws Exception {
        Response users = call("GET", "/api/auth/dev-users", null, null);
        assertThat(users.status()).isEqualTo(200);
        assertThat(users.body().findValuesAsString("role")).contains("PATHOLOGY", "ONCOLOGY", "ADMIN");
    }

    @Test
    void oncologyCannotEditClinicalDataButCanComment() throws Exception {
        String token = login(ONCOLOGY);
        Response create = call("POST", "/api/cases", token, Map.of(
                "caseCode", "ONC-1", "organ", "Pulmón", "tumorType", "Adenocarcinoma"));
        assertThat(create.status()).isEqualTo(403);

        String caseId = "20000000-0000-4000-8000-000000000001";
        Response comment = call("POST", "/api/cases/" + caseId + "/comments", token, Map.of(
                "targetType", "CASE", "targetId", caseId, "body", "Comentario oncológico de prueba"));
        assertThat(comment.status()).isEqualTo(201);
    }

    @Test
    void invalidInputIsRejectedWithProblemDetails() throws Exception {
        String token = login(PATHOLOGY);
        Response response = call("POST", "/api/cases", token, Map.of(
                "caseCode", "Juan Pérez 12.345.678", "organ", "", "tumorType", "x"));
        assertThat(response.status()).isEqualTo(400);
        assertThat(response.body().path("title").asString()).isEqualTo("Datos de entrada no válidos");
        assertThat(response.body().path("errors").findValuesAsString("field")).contains("caseCode", "organ");
    }

    @Test
    void duplicateCaseCodeIsAConflict() throws Exception {
        String token = login(PATHOLOGY);
        Response response = call("POST", "/api/cases", token, Map.of(
                "caseCode", "demo-001", "organ", "Pulmón", "tumorType", "Adenocarcinoma"));
        assertThat(response.status()).isEqualTo(409);
    }

    @Test
    void optimisticLockingPreventsSilentOverwrite() throws Exception {
        String token = login(PATHOLOGY);
        Response created = call("POST", "/api/cases", token, Map.of(
                "caseCode", "LOCK-1", "organ", "Colon", "tumorType", "Adenocarcinoma"));
        String id = created.body().path("id").asString();
        long version = created.body().path("version").asLong();
        Response first = call("PUT", "/api/cases/" + id, token, Map.of(
                "caseCode", "LOCK-1", "organ", "Colon", "tumorType", "Adenocarcinoma colorrectal", "version", version));
        assertThat(first.status()).isEqualTo(200);
        Response stale = call("PUT", "/api/cases/" + id, token, Map.of(
                "caseCode", "LOCK-1", "organ", "Colon", "tumorType", "Otro", "version", version));
        assertThat(stale.status()).isEqualTo(409);
    }

    @Test
    void manualEvidenceMustCiteASource() throws Exception {
        String token = login(MOLECULAR);
        Response response = call("POST", "/api/evidence", token, Map.of(
                "evidenceType", "FUNCTIONAL", "description", "Afirmación sin fuente"));
        assertThat(response.status()).isEqualTo(422);
    }

    @Test
    void userAssignedCertaintyIsRecordedWithItsBasis() throws Exception {
        String token = login(MOLECULAR);
        Response response = call("POST", "/api/evidence", token, Map.of(
                "geneSymbol", "TP53", "variantDescriptor", "p.Arg273His", "evidenceType", "FUNCTIONAL",
                "description", "Registro manual de prueba", "url", "https://example.org/registro-de-prueba",
                "certainty", "LIMITED"));
        assertThat(response.status()).isEqualTo(201);
        assertThat(response.body().path("certaintyBasis").asString()).isEqualTo("USER_ASSIGNED");
        assertThat(response.body().path("variantDescriptor").asString()).isEqualTo("R273H");
        assertThat(response.body().path("sourceCode").asString()).isEqualTo("MANUAL");
    }
}
