package com.molpath.board.search;

import com.molpath.board.search.SearchService.SearchResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/search")
@Tag(name = "Búsqueda global")
public class SearchController {

    private final SearchService service;

    public SearchController(SearchService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Búsqueda tipada: detecta PMID, gen+variante, símbolo (gen/IHQ/biomarcador) o texto libre")
    public SearchResponse search(@RequestParam @Size(min = 1, max = 120) String q,
            @RequestParam(required = false) Integer limit) {
        return service.search(q, limit);
    }
}
