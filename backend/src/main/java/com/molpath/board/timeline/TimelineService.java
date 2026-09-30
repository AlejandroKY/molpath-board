package com.molpath.board.timeline;

import com.molpath.board.audit.AuditService;
import com.molpath.board.casefile.CaseService;
import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.common.Text;
import com.molpath.board.molecular.MolecularRepositories.BiomarkerResultRepository;
import com.molpath.board.molecular.MolecularRepositories.MolecularTestRepository;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import com.molpath.board.molecular.MolecularTest;
import com.molpath.board.molecular.Variant;
import com.molpath.board.sample.Sample;
import com.molpath.board.sample.SampleRepositories.SampleRepository;
import com.molpath.board.security.CurrentUser;
import com.molpath.board.snapshot.SnapshotRepository;
import com.molpath.board.timeline.TimelineEvent.EventType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Línea de tiempo del caso: eventos explícitos más eventos derivados de los datos
 * (muestras, estudios moleculares y snapshots), sin duplicar información.
 */
@Service
@Transactional
public class TimelineService {

    public interface TimelineEventRepository extends JpaRepository<TimelineEvent, UUID> {
        List<TimelineEvent> findAllByCaseIdOrderByEventDateAsc(UUID caseId);
    }

    public enum EntryKind { EVENT, SAMPLE, MOLECULAR_TEST, SNAPSHOT }

    public record TimelineEventRequest(@NotNull EventType eventType, @NotNull LocalDate eventDate,
            @NotBlank @Size(max = 200) String title, @Size(max = 10000) String description, UUID sampleId) {

        public TimelineEventRequest {
            title = Text.clean(title);
            description = Text.clean(description);
        }
    }

    public record TimelineEventDto(UUID id, UUID caseId, EventType eventType, LocalDate eventDate, String title,
            String description, UUID sampleId) {

        public static TimelineEventDto from(TimelineEvent e) {
            return new TimelineEventDto(e.getId(), e.getCaseId(), e.getEventType(), e.getEventDate(), e.getTitle(),
                    e.getDescription(), e.getSampleId());
        }
    }

    public record TimelineEntry(LocalDate date, EntryKind kind, String eventType, String title, String detail,
            UUID refId, UUID sampleId) {}

    private final TimelineEventRepository events;
    private final SampleRepository samples;
    private final MolecularTestRepository tests;
    private final VariantRepository variants;
    private final BiomarkerResultRepository biomarkers;
    private final SnapshotRepository snapshots;
    private final CaseService caseService;
    private final CurrentUser currentUser;
    private final AuditService audit;

    public TimelineService(TimelineEventRepository events, SampleRepository samples, MolecularTestRepository tests,
            VariantRepository variants, BiomarkerResultRepository biomarkers, SnapshotRepository snapshots,
            CaseService caseService, CurrentUser currentUser, AuditService audit) {
        this.events = events;
        this.samples = samples;
        this.tests = tests;
        this.variants = variants;
        this.biomarkers = biomarkers;
        this.snapshots = snapshots;
        this.caseService = caseService;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<TimelineEntry> timeline(UUID caseId) {
        caseService.requireCase(caseId);
        List<TimelineEntry> entries = new ArrayList<>();
        for (TimelineEvent e : events.findAllByCaseIdOrderByEventDateAsc(caseId)) {
            entries.add(new TimelineEntry(e.getEventDate(), EntryKind.EVENT, e.getEventType().name(), e.getTitle(),
                    e.getDescription(), e.getId(), e.getSampleId()));
        }
        List<Sample> caseSamples = samples.findAllByCaseIdOrderByCollectionDateAscCreatedAtAsc(caseId);
        Map<UUID, Sample> sampleById = caseSamples.stream().collect(Collectors.toMap(Sample::getId, s -> s));
        for (Sample s : caseSamples) {
            if (s.getCollectionDate() != null) {
                String detail = s.getSampleType() + (s.getAnatomicSite() == null ? "" : " · " + s.getAnatomicSite())
                        + (s.getTumorCellularityPct() == null ? "" : " · celularidad tumoral " + s.getTumorCellularityPct().stripTrailingZeros().toPlainString() + "%");
                entries.add(new TimelineEntry(s.getCollectionDate(), EntryKind.SAMPLE, s.getSampleType().name(),
                        "Obtención de muestra: " + s.getLabel(), detail, s.getId(), s.getId()));
            }
        }
        List<MolecularTest> caseTests = caseSamples.isEmpty() ? List.of()
                : tests.findAllBySampleIdInOrderByTestDateAscCreatedAtAsc(sampleById.keySet());
        List<UUID> testIds = caseTests.stream().map(MolecularTest::getId).toList();
        Map<UUID, Long> variantCounts = testIds.isEmpty() ? Map.of()
                : variants.findAllByMolecularTestIdInOrderByCreatedAtAsc(testIds).stream()
                        .collect(Collectors.groupingBy(Variant::getMolecularTestId, Collectors.counting()));
        Map<UUID, Long> biomarkerCounts = testIds.isEmpty() ? Map.of()
                : biomarkers.findAllByMolecularTestIdInOrderByCreatedAtAsc(testIds).stream()
                        .collect(Collectors.groupingBy(b -> b.getMolecularTestId(), Collectors.counting()));
        for (MolecularTest t : caseTests) {
            if (t.getTestDate() != null) {
                Sample s = sampleById.get(t.getSampleId());
                entries.add(new TimelineEntry(t.getTestDate(), EntryKind.MOLECULAR_TEST, t.getTestType().name(),
                        "Estudio " + t.getTestType() + " sobre " + (s == null ? "muestra" : s.getLabel()),
                        variantCounts.getOrDefault(t.getId(), 0L) + " variante(s), "
                                + biomarkerCounts.getOrDefault(t.getId(), 0L) + " biomarcador(es)",
                        t.getId(), t.getSampleId()));
            }
        }
        for (SnapshotRepository.SnapshotHeader snap : snapshots.findHeadersByCaseId(caseId)) {
            entries.add(new TimelineEntry(snap.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate(),
                    EntryKind.SNAPSHOT, "SNAPSHOT", "Snapshot: " + snap.getLabel(), snap.getNote(), snap.getId(),
                    null));
        }
        entries.sort(Comparator.comparing(TimelineEntry::date).thenComparing(e -> e.kind().ordinal()));
        return entries;
    }

    @Transactional(readOnly = true)
    public List<TimelineEventDto> events(UUID caseId) {
        return events.findAllByCaseIdOrderByEventDateAsc(caseId).stream().map(TimelineEventDto::from).toList();
    }

    public TimelineEventDto createEvent(UUID caseId, TimelineEventRequest request) {
        caseService.requireCase(caseId);
        if (request.sampleId() != null && samples.findById(request.sampleId())
                .map(s -> !s.getCaseId().equals(caseId)).orElse(true)) {
            throw new BusinessRuleException("La muestra indicada no pertenece al caso.");
        }
        TimelineEvent saved = events.save(new TimelineEvent(null, caseId, request.eventType(), request.eventDate(),
                request.title(), request.description(), request.sampleId(), currentUser.id().orElse(null)));
        TimelineEventDto dto = TimelineEventDto.from(saved);
        audit.record(AuditService.CREATE, "TIMELINE_EVENT", saved.getId(), caseId, null, dto);
        return dto;
    }
}
