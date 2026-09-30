package com.molpath.board.provider.pubmed;

import com.molpath.board.common.Exceptions.ExternalServiceException;
import com.molpath.board.knowledge.KnowledgeEnums.SourceCodes;
import com.molpath.board.provider.ProviderContracts.ProviderInfo;
import com.molpath.board.provider.ProviderContracts.ProviderStatus;
import com.molpath.board.provider.ProviderContracts.PublicationProvider;
import com.molpath.board.provider.ProviderContracts.PublicationRecord;
import com.molpath.board.provider.VersionCache;
import com.molpath.board.provider.ncbi.NcbiClient;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/** PMID → metadatos mediante NCBI E-utilities (efetch XML). Sin scraping HTML. */
@Component
public class PubMedProvider implements PublicationProvider {

    private static final Pattern LAST_UPDATE = Pattern.compile("\"lastupdate\"\\s*:\\s*\"([^\"]+)\"");

    private final NcbiClient ncbi;
    private final VersionCache versionCache = new VersionCache(Duration.ofHours(1));

    public PubMedProvider(NcbiClient ncbi) {
        this.ncbi = ncbi;
    }

    @Override
    public ProviderInfo info() {
        return new ProviderInfo(SourceCodes.PUBMED, "PubMed (NCBI E-utilities)", "PMID → título, autores, revista, año, abstract, DOI",
                ProviderStatus.ENABLED, "API oficial de NCBI. Sin scraping.",
                "https://www.ncbi.nlm.nih.gov/books/NBK25501/");
    }

    @Override
    public Optional<PublicationRecord> fetchByPmid(String pmid) {
        String xml = ncbi.get(SourceCodes.PUBMED, "efetch.fcgi",
                Map.of("db", "pubmed", "id", pmid, "retmode", "xml"));
        return PubMedXmlParser.parse(xml).stream()
                .filter(r -> pmid.equals(r.pmid()))
                .filter(r -> r.title() != null)
                .findFirst();
    }

    @Override
    public String currentVersionLabel() {
        return versionCache.get(() -> {
            String json = ncbi.get(SourceCodes.PUBMED, "einfo.fcgi", Map.of("db", "pubmed", "retmode", "json"));
            Matcher m = LAST_UPDATE.matcher(json);
            if (!m.find()) {
                throw new ExternalServiceException(SourceCodes.PUBMED, "NCBI einfo no devolvió 'lastupdate'");
            }
            return "NCBI E-utilities (PubMed lastupdate " + m.group(1) + ")";
        });
    }
}
