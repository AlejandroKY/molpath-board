import { QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserDemoGateway } from '../data/demo/browserDemoGateway';
import { App } from './App';

/**
 * Flujo mínimo exigido, a través de la interfaz:
 * crear caso → añadir muestra → añadir IHQ → añadir estudio molecular → añadir variante →
 * verla dentro de la pizarra → crear snapshot.
 */
describe('flujo clínico completo en la interfaz', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = '#/';
  });

  it('crea un caso ficticio y lo lleva hasta un snapshot de la pizarra', async () => {
    const user = userEvent.setup();
    const gateway = new BrowserDemoGateway(null);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<App gateway={gateway} queryClient={queryClient} />);

    await user.click(await screen.findByRole('button', { name: /Lic\. Bruno Demo/ }));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    // crear caso
    window.location.hash = '#/cases/new';
    await user.type(await screen.findByLabelText(/Case ID/), 'TEST-UI-1');
    await user.type(screen.getByLabelText(/^Órgano/), 'Pulmón');
    await user.type(screen.getByLabelText(/^Tipo tumoral/), 'Adenocarcinoma pulmonar');
    await user.click(screen.getByRole('button', { name: 'Crear caso' }));
    expect(await screen.findByRole('heading', { name: 'TEST-UI-1' })).toBeInTheDocument();

    // muestra
    await user.click(screen.getByRole('button', { name: 'Añadir muestra' }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Etiqueta/), 'Biopsia 1');
    await user.type(within(dialog).getByLabelText(/Porcentaje tumoral/), '40');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('heading', { name: 'Biopsia 1' })).toBeInTheDocument();

    // IHQ
    await user.click(screen.getByRole('button', { name: 'Añadir marcador' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Marcador/), 'TTF-1');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect((await screen.findAllByText('TTF-1')).length).toBeGreaterThan(0);

    // estudio molecular
    await user.click(screen.getByRole('button', { name: 'Añadir estudio' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Genes analizados/), 'EGFR, TP53');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('button', { name: 'Añadir variante' })).toBeInTheDocument();

    // variante
    await user.click(screen.getByRole('button', { name: 'Añadir variante' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Gen \(símbolo/), 'EGFR');
    await user.type(within(dialog).getByLabelText(/HGVS p\./), 'p.Leu858Arg');
    await user.type(within(dialog).getByLabelText(/^VAF/), '32.5');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect((await screen.findAllByText('p.Leu858Arg')).length).toBeGreaterThan(0);

    // pizarra
    await user.click(screen.getByRole('link', { name: 'Abrir pizarra' }));
    const outline = await screen.findByRole('list', { name: 'Nodos del grafo' }, { timeout: 5000 });
    expect(within(outline).getByText(/EGFR p\.Leu858Arg/)).toBeInTheDocument();
    await user.click(within(outline).getByText(/EGFR p\.Leu858Arg/));
    expect(await screen.findByRole('heading', { name: 'EGFR p.Leu858Arg', level: 2 })).toBeInTheDocument();

    // snapshot
    await user.click(screen.getByRole('button', { name: 'Crear snapshot' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Crear snapshot' }));
    expect(await within(dialog).findByText(/Huella SHA-256/)).toBeInTheDocument();

    const snapshots = await gateway.listSnapshots(0, 10);
    expect(snapshots.items[0].caseCode).toBe('TEST-UI-1');
    const detail = await gateway.getSnapshot(snapshots.items[0].id);
    expect(detail.integrityVerified).toBe(true);
    expect(detail.content.board.variants[0].proteinChange).toBe('L858R');
  }, 30000);
});
