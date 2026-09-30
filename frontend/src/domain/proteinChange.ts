// Misma regla que ProteinChange.java: p.Leu858Arg | p.(Leu858Arg) | p.L858R | L858R → L858R
const THREE_TO_ONE: Record<string, string> = {
  Ala: 'A', Arg: 'R', Asn: 'N', Asp: 'D', Cys: 'C', Gln: 'Q', Glu: 'E', Gly: 'G', His: 'H', Ile: 'I',
  Leu: 'L', Lys: 'K', Met: 'M', Phe: 'F', Pro: 'P', Ser: 'S', Thr: 'T', Trp: 'W', Tyr: 'Y', Val: 'V',
  Ter: '*', Sec: 'U', Pyl: 'O',
};

export function normalizeProteinChange(hgvsP: string | null | undefined): string | null {
  if (hgvsP == null) return null;
  let value = hgvsP.trim();
  if (value.toLowerCase().startsWith('p.')) value = value.slice(2);
  if (value.startsWith('(') && value.endsWith(')')) value = value.slice(1, -1);
  const normalized = value.replace(/[A-Z][a-z]{2}/g, (m) => THREE_TO_ONE[m] ?? m).trim();
  return normalized.length ? normalized : null;
}

export function toThreeLetter(normalized: string | null): string | null {
  if (!normalized) return null;
  const m = /^([A-Z*])(\d+)([A-Z*])$/.exec(normalized);
  if (!m) return null;
  const inverse = (one: string) => Object.entries(THREE_TO_ONE).find(([, v]) => v === one)?.[0] ?? one;
  return `${inverse(m[1])}${m[2]}${inverse(m[3])}`;
}
