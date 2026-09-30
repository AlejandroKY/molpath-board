import { normalizeProteinChange } from './proteinChange';
import type { EntityKind } from './types';

// Misma regla que QueryClassifier.java (el modo demo la usa en el navegador).
export interface ClassifiedQuery {
  normalized: string;
  kinds: EntityKind[];
  geneSymbol: string | null;
  proteinChange: string | null;
  hgvsC: string | null;
  pmid: string | null;
}

const PMID = /^(?:PMID\s*:?\s*)?(\d{1,9})$/i;
const SYMBOL = /^[A-Za-z0-9][A-Za-z0-9.-]{0,19}$/;
const PROTEIN = /^(?:p\.)?\(?[A-Z](?:[a-z]{2})?\d+[A-Za-z*_]*\d*[A-Za-z*]*\)?$/;
const CDNA = /^c\.\S+$/;
const hasLetter = (s: string) => /[A-Za-z]/.test(s);

export function classifyQuery(raw: string): ClassifiedQuery {
  const q = (raw ?? '').trim().replace(/\s+/g, ' ');
  const base = { normalized: q, geneSymbol: null, proteinChange: null, hgvsC: null, pmid: null };
  if (!q) return { ...base, kinds: [] };
  const pmid = PMID.exec(q);
  if (pmid) return { ...base, kinds: ['PMID'], pmid: pmid[1] };
  const tokens = q.split(' ');
  if (tokens.length === 2 && SYMBOL.test(tokens[0]) && hasLetter(tokens[0])) {
    const gene = tokens[0].toUpperCase();
    if (PROTEIN.test(tokens[1])) {
      return { ...base, kinds: ['VARIANT', 'GENE'], geneSymbol: gene, proteinChange: normalizeProteinChange(tokens[1]) };
    }
    if (CDNA.test(tokens[1])) return { ...base, kinds: ['VARIANT', 'GENE'], geneSymbol: gene, hgvsC: tokens[1] };
  }
  if (tokens.length === 1 && SYMBOL.test(q) && hasLetter(q)) {
    return { ...base, kinds: ['GENE', 'IHC_MARKER', 'BIOMARKER', 'CASE', 'PATHWAY'], geneSymbol: q.toUpperCase() };
  }
  return { ...base, kinds: ['TUMOR', 'CASE', 'IHC_MARKER', 'BIOMARKER', 'PATHWAY', 'EVIDENCE'] };
}
