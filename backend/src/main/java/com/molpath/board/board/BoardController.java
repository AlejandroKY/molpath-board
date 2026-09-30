package com.molpath.board.board;

import com.molpath.board.board.CaseBoardService.CaseBoard;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cases/{caseId}/board")
@Tag(name = "Pizarra Molecular Viva")
public class BoardController {

    private final CaseBoardService service;

    public BoardController(CaseBoardService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Agregado completo del caso para la pizarra (datos del caso, conocimiento enlazado, razonamiento)")
    public CaseBoard board(@PathVariable UUID caseId) {
        return service.load(caseId, true);
    }
}
