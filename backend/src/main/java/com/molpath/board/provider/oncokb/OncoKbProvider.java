package com.molpath.board.provider.oncokb;

import com.molpath.board.common.Exceptions.ProviderUnavailableException;
import com.molpath.board.knowledge.KnowledgeEnums.SourceCodes;
import com.molpath.board.provider.ProviderContracts.EvidenceCandidate;
import com.molpath.board.provider.ProviderContracts.EvidenceProvider;
import com.molpath.board.provider.ProviderContracts.EvidenceSearchResult;
import com.molpath.board.provider.ProviderContracts.ProviderInfo;
import com.molpath.board.provider.ProviderContracts.ProviderStatus;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Adaptador OncoKB — desactivado (ADR-012).
 *
 * <p>La API de OncoKB (https://www.oncokb.org/api/v1, p. ej. {@code /annotate/mutations/byProteinChange})
 * requiere un token personal y la aceptación de términos que restringen el uso, almacenamiento y
 * redistribución de sus datos según el tipo de licencia (académica/comercial). No se asume reutilización
 * libre: el adaptador no realiza llamadas hasta que el titular del proyecto revise la licencia,
 * obtenga un token y se implemente y verifique la integración.</p>
 */
@Component
public class OncoKbProvider implements EvidenceProvider {

    private static final String REASON =
            "Integración pendiente de revisión de licencia y términos de uso de OncoKB (ver DECISIONS.md, ADR-012).";

    @Override
    public ProviderInfo info() {
        return new ProviderInfo(SourceCodes.ONCOKB, "OncoKB", "Anotación oncológica de variantes",
                ProviderStatus.LICENSE_REVIEW_REQUIRED, REASON, "https://www.oncokb.org/api-access");
    }

    @Override
    public EvidenceSearchResult search(String geneSymbol, String proteinChange, int size, String cursor) {
        throw new ProviderUnavailableException(SourceCodes.ONCOKB, REASON);
    }

    @Override
    public Optional<EvidenceCandidate> fetchById(String externalId) {
        throw new ProviderUnavailableException(SourceCodes.ONCOKB, REASON);
    }

    @Override
    public String currentVersionLabel() {
        throw new ProviderUnavailableException(SourceCodes.ONCOKB, REASON);
    }
}
