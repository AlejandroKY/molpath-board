package com.molpath.board.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Base de pruebas de API contra PostgreSQL embebido, con el dataset demo sembrado. */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class IntegrationTest {

    public static final String MOLECULAR = "molecular.demo";
    public static final String ONCOLOGY = "oncologia.demo";
    public static final String PATHOLOGY = "patologia.demo";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper json;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", EmbeddedPg::jdbcUrl);
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("molpath.security.jwt-secret", () -> "test-only-secret-0123456789-abcdefghijklmnop");
        registry.add("molpath.security.dev-login-enabled", () -> "true");
        registry.add("molpath.demo.seed", () -> "true");
    }

    protected String login(String username) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/dev-login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", username)))).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).path("token").asString();
    }

    protected Response call(String method, String url, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder request = switch (method) {
            case "GET" -> get(url);
            case "POST" -> post(url);
            case "PUT" -> put(url);
            case "DELETE" -> delete(url);
            default -> throw new IllegalArgumentException(method);
        };
        if (token != null) {
            request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        }
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        MvcResult result = mvc.perform(request).andReturn();
        String content = result.getResponse().getContentAsString();
        return new Response(result.getResponse().getStatus(), content.isEmpty() ? null : json.readTree(content));
    }

    public record Response(int status, JsonNode body) {}
}
