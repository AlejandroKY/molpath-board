package com.molpath.board.casefile;

import com.molpath.board.audit.AuditService;
import com.molpath.board.casefile.CaseDtos.CaseDto;
import com.molpath.board.casefile.CaseDtos.CaseRequest;
import com.molpath.board.casefile.CaseDtos.CaseSummary;
import com.molpath.board.common.Exceptions.ConflictException;
import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.common.PageResponse;
import com.molpath.board.common.Text;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import com.molpath.board.sample.SampleRepositories.SampleRepository;
import com.molpath.board.security.CurrentUser;
import com.molpath.board.user.AppUserRepository;
import com.molpath.board.user.UserSummary;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CaseService {

    private final TumorCaseRepository cases;
    private final SampleRepository samples;
    private final VariantRepository variants;
    private final AppUserRepository users;
    private final CurrentUser currentUser;
    private final AuditService audit;

    public CaseService(TumorCaseRepository cases, SampleRepository samples, VariantRepository variants,
            AppUserRepository users, CurrentUser currentUser, AuditService audit) {
        this.cases = cases;
        this.samples = samples;
        this.variants = variants;
        this.users = users;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public PageResponse<CaseSummary> list(String query, Integer page, Integer size) {
        Pageable pageable = PageResponse.pageable(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        String q = Text.clean(query);
        Page<TumorCase> result = q == null ? cases.findAll(pageable)
                : cases.search("%" + q.toLowerCase(Locale.ROOT) + "%", pageable);
        List<UUID> ids = result.getContent().stream().map(TumorCase::getId).toList();
        Map<UUID, Long> sampleCounts = toMap(ids.isEmpty() ? List.of() : samples.countByCaseIds(ids));
        Map<UUID, Long> variantCounts = toMap(ids.isEmpty() ? List.of() : variants.countByCaseIds(ids));
        return PageResponse.of(result, c -> new CaseSummary(c.getId(), c.getCaseCode(), c.getOrgan(),
                c.getTumorType(), c.getDiagnosis(), c.isDemo(), c.getCreatedAt(), c.getUpdatedAt(),
                sampleCounts.getOrDefault(c.getId(), 0L), variantCounts.getOrDefault(c.getId(), 0L)));
    }

    @Transactional(readOnly = true)
    public CaseDto get(UUID id) {
        return toDto(requireCase(id));
    }

    public CaseDto create(CaseRequest request) {
        String code = normalizeCode(request.caseCode());
        if (cases.existsByCaseCodeIgnoreCase(code)) {
            throw new ConflictException("Ya existe un caso con el identificador " + code);
        }
        TumorCase tumorCase = new TumorCase(null, code, currentUser.id().orElse(null));
        describe(tumorCase, request);
        CaseDto created = toDto(cases.saveAndFlush(tumorCase));
        audit.record(AuditService.CREATE, "CASE", created.id(), created.id(), null, created);
        return created;
    }

    public CaseDto update(UUID id, CaseRequest request) {
        TumorCase tumorCase = requireCase(id);
        if (request.version() != null && !Objects.equals(request.version(), tumorCase.getVersion())) {
            throw new ConflictException("El caso fue modificado por otra persona. Recargue antes de guardar.");
        }
        String code = normalizeCode(request.caseCode());
        if (!code.equalsIgnoreCase(tumorCase.getCaseCode()) && cases.existsByCaseCodeIgnoreCase(code)) {
            throw new ConflictException("Ya existe un caso con el identificador " + code);
        }
        CaseDto before = toDto(tumorCase);
        tumorCase.changeCaseCode(code);
        describe(tumorCase, request);
        CaseDto after = toDto(cases.saveAndFlush(tumorCase));
        audit.record(AuditService.UPDATE, "CASE", id, id, before, after);
        return after;
    }

    @Transactional(readOnly = true)
    public TumorCase requireCase(UUID id) {
        return cases.findById(id).orElseThrow(() -> new NotFoundException("Caso", id));
    }

    public CaseDto toDto(TumorCase c) {
        UserSummary createdBy = c.getCreatedBy() == null ? null
                : users.findById(c.getCreatedBy()).map(UserSummary::from).orElse(null);
        return CaseDto.from(c, createdBy);
    }

    private static void describe(TumorCase tumorCase, CaseRequest r) {
        tumorCase.describe(Text.clean(r.organ()), Text.clean(r.tumorType()), Text.clean(r.diagnosis()),
                Text.clean(r.histologicSubtype()), Text.clean(r.grade()), Text.clean(r.notes()));
    }

    private static String normalizeCode(String code) {
        return Text.upper(code);
    }

    private static Map<UUID, Long> toMap(List<Object[]> rows) {
        Map<UUID, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return map;
    }
}
