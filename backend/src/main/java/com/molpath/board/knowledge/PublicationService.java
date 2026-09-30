package com.molpath.board.knowledge;

import com.molpath.board.audit.AuditService;
import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.common.PageResponse;
import com.molpath.board.common.Text;
import com.molpath.board.knowledge.KnowledgeDtos.PublicationDto;
import com.molpath.board.knowledge.KnowledgeEnums.SourceCodes;
import com.molpath.board.knowledge.KnowledgeRepositories.PublicationRepository;
import com.molpath.board.provider.ProviderContracts.PublicationProvider;
import com.molpath.board.provider.ProviderContracts.PublicationRecord;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PublicationService {

    private final PublicationRepository publications;
    private final PublicationProvider provider;
    private final SourceVersionService sourceVersions;
    private final AuditService audit;

    public PublicationService(PublicationRepository publications, PublicationProvider provider,
            SourceVersionService sourceVersions, AuditService audit) {
        this.publications = publications;
        this.provider = provider;
        this.sourceVersions = sourceVersions;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public PageResponse<PublicationDto> list(String query, Integer page, Integer size) {
        Pageable pageable = PageResponse.pageable(page, size, Sort.by(Sort.Direction.DESC, "retrievedAt"));
        String q = Text.clean(query);
        Page<Publication> result = q == null ? publications.findAll(pageable)
                : publications.search("%" + q.toLowerCase(Locale.ROOT) + "%", pageable);
        return PageResponse.of(result, PublicationDto::from);
    }

    @Transactional(readOnly = true)
    public PublicationDto getByPmid(String pmid) {
        return publications.findByPmid(pmid).map(PublicationDto::from)
                .orElseThrow(() -> new NotFoundException("Publicación con PMID", pmid));
    }

    /**
     * Importa (o refresca) una publicación desde PubMed. Si el PMID no existe en PubMed, falla:
     * nunca se crea una publicación sin verificar.
     */
    public Publication importByPmid(String pmid, boolean refresh) {
        Optional<Publication> existing = publications.findByPmid(pmid);
        if (existing.isPresent() && !refresh) {
            return existing.get();
        }
        PublicationRecord record = provider.fetchByPmid(pmid)
                .orElseThrow(() -> new NotFoundException("PMID en PubMed", pmid));
        SourceVersion version = sourceVersions.resolve(SourceCodes.PUBMED, provider.currentVersionLabel());
        PublicationDto before = existing.map(PublicationDto::from).orElse(null);
        Publication publication = existing.orElseGet(() -> new Publication(null, pmid));
        publication.refresh(record.doi(), record.title(), record.authors(), record.journal(), record.pubYear(),
                record.pubDate(), record.abstractText(), version.getId(), Instant.now());
        Publication saved = publications.saveAndFlush(publication);
        audit.record(before == null ? AuditService.IMPORT : AuditService.UPDATE, "PUBLICATION", pmid, null, before,
                PublicationDto.from(saved));
        return saved;
    }
}
