package com.molpath.board.knowledge;

import com.molpath.board.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Publicación identificada por PMID. La URL de PubMed se deriva del PMID, no se almacena. */
@Entity
@Table(name = "publication")
public class Publication extends BaseEntity {

    public static final String PUBMED_BASE_URL = "https://pubmed.ncbi.nlm.nih.gov/";

    @Column(nullable = false, unique = true, length = 12)
    private String pmid;

    @Column(length = 200)
    private String doi;

    @Column(nullable = false)
    private String title;

    @Column
    private String authors;

    @Column(length = 300)
    private String journal;

    @Column(name = "pub_year")
    private Integer pubYear;

    @Column(name = "pub_date", length = 40)
    private String pubDate;

    @Column(name = "abstract_text")
    private String abstractText;

    @Column(name = "source_version_id")
    private UUID sourceVersionId;

    @Column(name = "retrieved_at", nullable = false)
    private Instant retrievedAt;

    protected Publication() {
    }

    public Publication(UUID id, String pmid) {
        super(id);
        this.pmid = pmid;
    }

    public void refresh(String doi, String title, String authors, String journal, Integer pubYear, String pubDate,
            String abstractText, UUID sourceVersionId, Instant retrievedAt) {
        this.doi = doi;
        this.title = title;
        this.authors = authors;
        this.journal = journal;
        this.pubYear = pubYear;
        this.pubDate = pubDate;
        this.abstractText = abstractText;
        this.sourceVersionId = sourceVersionId;
        this.retrievedAt = retrievedAt;
    }

    public static String pubmedUrl(String pmid) {
        return pmid == null ? null : PUBMED_BASE_URL + pmid + "/";
    }

    public String getPmid() {
        return pmid;
    }

    public String getDoi() {
        return doi;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthors() {
        return authors;
    }

    public String getJournal() {
        return journal;
    }

    public Integer getPubYear() {
        return pubYear;
    }

    public String getPubDate() {
        return pubDate;
    }

    public String getAbstractText() {
        return abstractText;
    }

    public UUID getSourceVersionId() {
        return sourceVersionId;
    }

    public Instant getRetrievedAt() {
        return retrievedAt;
    }
}
