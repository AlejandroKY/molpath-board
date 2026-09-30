package com.molpath.board.config;

import java.net.http.HttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** Cliente HTTP compartido por los proveedores externos, con tiempos de espera acotados. */
@Configuration
public class ExternalHttpConfig {

    @Bean
    public RestClient externalRestClient(AppProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.providers().timeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(properties.providers().timeout());
        return RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("User-Agent", "MolPathBoard/0.1 (research support tool)")
                .build();
    }
}
