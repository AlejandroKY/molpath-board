import { useMutation } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disclaimer, ErrorBox, PageHead, useForm } from '../../components/ui';
import { useGateway } from '../../data/GatewayProvider';
import { CaseFields, caseRequestFrom, useInvalidateCase } from './forms';

export function CaseCreatePage() {
  const { gateway } = useGateway();
  const navigate = useNavigate();
  const invalidate = useInvalidateCase();
  const { values, set } = useForm<Record<string, unknown>>({ caseCode: '', organ: '', tumorType: '', diagnosis: '', histologicSubtype: '', grade: '', notes: '' });
  const m = useMutation({
    mutationFn: () => gateway.createCase(caseRequestFrom(values)),
    onSuccess: (c) => { invalidate(); navigate(`/cases/${c.id}`); },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate(); };
  return (
    <>
      <PageHead title="Crear caso" crumbs={[{ to: '/cases', label: 'Casos' }, { label: 'Crear caso' }]} />
      <Disclaimer>
        <br />No introduzca datos identificables de pacientes reales (nombre, documento, historia clínica, fechas de nacimiento): esta fase sólo admite casos ficticios.
      </Disclaimer>
      <form className="card" onSubmit={submit} noValidate>
        <div className="card-body stack">
          <CaseFields values={values} set={set as never} error={m.error} />
          <ErrorBox error={m.error} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => navigate('/cases')}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={m.isPending}>{m.isPending ? 'Creando…' : 'Crear caso'}</button>
          </div>
        </div>
      </form>
    </>
  );
}
