import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Menu } from '../../components/scientific';
import type { Publication, Sample, Variant } from '../../domain/types';

function CopyItem({ label, value, close }: { label: string; value: string; close: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="menu-item"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(close, 600);
        } catch {
          close();
        }
      }}
    >
      <Icon name={done ? 'check' : 'copy'} /> {done ? 'Copiado' : label} <span className="mono tiny muted">{value}</span>
    </button>
  );
}

export function VariantActions({ caseId, variant, onFocus, onSources }: { caseId: string; variant: Variant; onFocus?: () => void; onSources?: () => void }) {
  const node = `variant:${variant.id}`;
  const hgvs = [variant.transcript, variant.hgvsC, variant.hgvsP].filter(Boolean).join(' ');
  return (
    <Menu label="Acciones" icon="more" buttonClass="btn small" align="right">
      {(close) => (
        <>
          {hgvs && <CopyItem label="Copiar HGVS" value={hgvs} close={close} />}
          <CopyItem label="Copiar gen" value={variant.geneSymbol} close={close} />
          {onFocus ? (
            <button type="button" className="menu-item" onClick={() => { onFocus(); close(); }}><Icon name="focus" /> Enfocar en la pizarra</button>
          ) : (
            <Link className="menu-item" to={`/cases/${caseId}/board?node=${node}&focus=1`} onClick={close}><Icon name="focus" /> Enfocar en la pizarra</Link>
          )}
          {onSources ? (
            <button type="button" className="menu-item" onClick={() => { onSources(); close(); }}><Icon name="globe" /> Abrir fuentes externas</button>
          ) : (
            <Link className="menu-item" to={`/cases/${caseId}/board?node=${node}&tab=sources`} onClick={close}><Icon name="globe" /> Abrir fuentes externas</Link>
          )}
          <Link className="menu-item" to={`/evidence?gene=${encodeURIComponent(variant.geneSymbol)}`} onClick={close}><Icon name="evidence" /> Ver evidencias del gen</Link>
        </>
      )}
    </Menu>
  );
}

export function PublicationActions({ publication }: { publication: Publication }) {
  return (
    <Menu label="Acciones" icon="more" buttonClass="btn small" align="right">
      {(close) => (
        <>
          <CopyItem label="Copiar PMID" value={publication.pmid} close={close} />
          <a className="menu-item" href={publication.pubmedUrl} target="_blank" rel="noopener noreferrer" onClick={close}><Icon name="external" /> Abrir en PubMed</a>
          {publication.doiUrl && <a className="menu-item" href={publication.doiUrl} target="_blank" rel="noopener noreferrer" onClick={close}><Icon name="external" /> Abrir DOI</a>}
        </>
      )}
    </Menu>
  );
}

export function SampleActions({ caseId, sample, canCompare }: { caseId: string; sample: Sample; canCompare: boolean }) {
  return (
    <Menu label="Acciones" icon="more" buttonClass="btn small" align="right">
      {(close) => (
        <>
          <Link className="menu-item" to={`/cases/${caseId}/board?node=sample:${sample.id}&focus=1`} onClick={close}><Icon name="focus" /> Enfocar en la pizarra</Link>
          <a className="menu-item" href={`#tests-${sample.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`tests-${sample.id}`)?.scrollIntoView({ behavior: 'smooth' }); close(); }}><Icon name="evidence" /> Ver estudios moleculares</a>
          {canCompare && <Link className="menu-item" to={`/cases/${caseId}/timeline?compare=${sample.id}`} onClick={close}><Icon name="timeline" /> Comparar con otra muestra</Link>}
        </>
      )}
    </Menu>
  );
}
