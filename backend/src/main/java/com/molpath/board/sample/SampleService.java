package com.molpath.board.sample;

import com.molpath.board.audit.AuditService;
import com.molpath.board.casefile.CaseService;
import com.molpath.board.common.Exceptions.ConflictException;
import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.sample.SampleDtos.HistologyDto;
import com.molpath.board.sample.SampleDtos.HistologyRequest;
import com.molpath.board.sample.SampleDtos.IhcDto;
import com.molpath.board.sample.SampleDtos.IhcRequest;
import com.molpath.board.sample.SampleDtos.SampleDto;
import com.molpath.board.sample.SampleDtos.SampleRequest;
import com.molpath.board.sample.SampleRepositories.HistologyFindingRepository;
import com.molpath.board.sample.SampleRepositories.IhcResultRepository;
import com.molpath.board.sample.SampleRepositories.SampleRepository;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SampleService {

    private final SampleRepository samples;
    private final HistologyFindingRepository histology;
    private final IhcResultRepository ihc;
    private final CaseService caseService;
    private final AuditService audit;

    public SampleService(SampleRepository samples, HistologyFindingRepository histology, IhcResultRepository ihc,
            CaseService caseService, AuditService audit) {
        this.samples = samples;
        this.histology = histology;
        this.ihc = ihc;
        this.caseService = caseService;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<SampleDto> listByCase(UUID caseId) {
        caseService.requireCase(caseId);
        return samples.findAllByCaseIdOrderByCollectionDateAscCreatedAtAsc(caseId).stream().map(SampleDto::from)
                .toList();
    }

    public SampleDto create(UUID caseId, SampleRequest request) {
        caseService.requireCase(caseId);
        Sample sample = new Sample(null, caseId);
        sample.apply(request);
        SampleDto created = SampleDto.from(samples.saveAndFlush(sample));
        audit.record(AuditService.CREATE, "SAMPLE", created.id(), caseId, null, created);
        return created;
    }

    public SampleDto update(UUID sampleId, SampleRequest request) {
        Sample sample = requireSample(sampleId);
        if (request.version() != null && !Objects.equals(request.version(), sample.getVersion())) {
            throw new ConflictException("La muestra fue modificada por otra persona. Recargue antes de guardar.");
        }
        SampleDto before = SampleDto.from(sample);
        sample.apply(request);
        SampleDto after = SampleDto.from(samples.saveAndFlush(sample));
        audit.record(AuditService.UPDATE, "SAMPLE", sampleId, sample.getCaseId(), before, after);
        return after;
    }

    public HistologyDto addHistology(UUID sampleId, HistologyRequest request) {
        Sample sample = requireSample(sampleId);
        HistologyFinding finding = new HistologyFinding(null, sampleId);
        finding.apply(request);
        HistologyDto created = HistologyDto.from(histology.save(finding));
        audit.record(AuditService.CREATE, "HISTOLOGY", created.id(), sample.getCaseId(), null, created);
        return created;
    }

    public HistologyDto updateHistology(UUID histologyId, HistologyRequest request) {
        HistologyFinding finding = histology.findById(histologyId)
                .orElseThrow(() -> new NotFoundException("Hallazgo histológico", histologyId));
        HistologyDto before = HistologyDto.from(finding);
        finding.apply(request);
        HistologyDto after = HistologyDto.from(histology.save(finding));
        audit.record(AuditService.UPDATE, "HISTOLOGY", histologyId, caseIdOf(finding.getSampleId()), before, after);
        return after;
    }

    public IhcDto addIhc(UUID sampleId, IhcRequest request) {
        Sample sample = requireSample(sampleId);
        IhcResult result = new IhcResult(null, sampleId);
        result.apply(request);
        IhcDto created = IhcDto.from(ihc.save(result));
        audit.record(AuditService.CREATE, "IHC", created.id(), sample.getCaseId(), null, created);
        return created;
    }

    public IhcDto updateIhc(UUID ihcId, IhcRequest request) {
        IhcResult result = requireIhc(ihcId);
        IhcDto before = IhcDto.from(result);
        result.apply(request);
        IhcDto after = IhcDto.from(ihc.save(result));
        audit.record(AuditService.UPDATE, "IHC", ihcId, caseIdOf(result.getSampleId()), before, after);
        return after;
    }

    public void deleteIhc(UUID ihcId) {
        IhcResult result = requireIhc(ihcId);
        audit.record(AuditService.DELETE, "IHC", ihcId, caseIdOf(result.getSampleId()), IhcDto.from(result), null);
        ihc.delete(result);
    }

    @Transactional(readOnly = true)
    public Sample requireSample(UUID sampleId) {
        return samples.findById(sampleId).orElseThrow(() -> new NotFoundException("Muestra", sampleId));
    }

    private IhcResult requireIhc(UUID ihcId) {
        return ihc.findById(ihcId).orElseThrow(() -> new NotFoundException("Resultado IHQ", ihcId));
    }

    private UUID caseIdOf(UUID sampleId) {
        return requireSample(sampleId).getCaseId();
    }
}
