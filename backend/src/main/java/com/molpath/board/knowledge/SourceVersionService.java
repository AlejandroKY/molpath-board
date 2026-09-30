package com.molpath.board.knowledge;

import com.molpath.board.knowledge.KnowledgeRepositories.SourceVersionRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SourceVersionService {

    private final SourceVersionRepository repository;

    public SourceVersionService(SourceVersionRepository repository) {
        this.repository = repository;
    }

    /** Devuelve la versión registrada con esa etiqueta o la registra con la fecha de consulta actual. */
    public SourceVersion resolve(String sourceCode, String versionLabel) {
        return repository.findBySourceCodeAndVersionLabel(sourceCode, versionLabel)
                .orElseGet(() -> repository.save(new SourceVersion(null, sourceCode, versionLabel, Instant.now())));
    }
}
