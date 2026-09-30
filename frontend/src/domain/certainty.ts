import type { Certainty, Evidence, EvidenceType, InterpretationScope } from './types';

/**
 * Regla documentada (ARCHITECTURE.md, ADR-005) — idéntica a CivicMapper.java.
 * A→STRONG, B→MODERATE, C/D→LIMITED, E→INSUFFICIENT; otro valor → UNKNOWN.
 */
export function civicCertainty(level: string | null | undefined): Certainty {
  switch ((level ?? '').trim().toUpperCase()) {
    case 'A':
      return 'STRONG';
    case 'B':
      return 'MODERATE';
    case 'C':
    case 'D':
      return 'LIMITED';
    case 'E':
      return 'INSUFFICIENT';
    default:
      return 'UNKNOWN';
  }
}

export function civicEvidenceType(t: string | null | undefined): EvidenceType | null {
  const map: Record<string, EvidenceType> = {
    PREDICTIVE: 'PREDICTIVE',
    DIAGNOSTIC: 'DIAGNOSTIC',
    PROGNOSTIC: 'PROGNOSTIC',
    PREDISPOSING: 'PREDISPOSITION',
    ONCOGENIC: 'ONCOGENIC',
    FUNCTIONAL: 'FUNCTIONAL',
  };
  return map[(t ?? '').toUpperCase()] ?? null;
}

export function civicScope(origin: string | null | undefined): InterpretationScope {
  const o = (origin ?? '').toUpperCase();
  if (o === 'SOMATIC') return 'SOMATIC';
  if (o.includes('GERMLINE')) return 'GERMLINE';
  return 'NOT_APPLICABLE';
}

export interface Contradiction {
  key: string;
  evidenceIds: string[];
  description: string;
}

/**
 * Detecta contradicciones entre registros de fuentes (ADR-005): para un mismo tipo de evidencia y
 * significado, existen registros vigentes que apoyan (SUPPORTS) y que no apoyan (DOES_NOT_SUPPORT).
 * No infiere nada más: sólo compara lo que las fuentes registran.
 */
export function detectContradictions(evidence: Evidence[]): Contradiction[] {
  const groups = new Map<string, Evidence[]>();
  for (const e of evidence) {
    if (e.status !== 'ACTIVE' || !e.sourceDirection || !e.sourceSignificance) continue;
    const key = `${e.geneSymbol ?? ''}|${e.variantDescriptor ?? ''}|${e.evidenceType}|${e.sourceSignificance}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const result: Contradiction[] = [];
  for (const [key, items] of groups) {
    const directions = new Set(items.map((e) => e.sourceDirection));
    if (directions.has('SUPPORTS') && directions.has('DOES_NOT_SUPPORT')) {
      const [, variant, type, significance] = key.split('|');
      result.push({
        key,
        evidenceIds: items.map((e) => e.id),
        description: `Registros con direcciones opuestas para ${variant || 'la variante'} · ${type} · ${significance}`,
      });
    }
  }
  return result;
}

/** Resumen de certeza de un conjunto de evidencias para la vista rápida de una variante. */
export function certaintyDistribution(evidence: Evidence[]): Record<Certainty, number> {
  const dist: Record<Certainty, number> = { STRONG: 0, MODERATE: 0, LIMITED: 0, CONTRADICTORY: 0, INSUFFICIENT: 0, UNKNOWN: 0 };
  for (const e of evidence) if (e.status === 'ACTIVE') dist[e.certainty] += 1;
  return dist;
}
