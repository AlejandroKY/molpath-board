import { QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { BrowserDemoGateway } from '../../data/demo/browserDemoGateway';

const DEMO_001 = '20000000-0000-4000-8000-000000000001';

async function openBoard(mobile = false) {
  window.__mobile = mobile;
  window.localStorage.clear();
  const gateway = new BrowserDemoGateway(null);
  const s = await gateway.login('molecular.demo');
  window.localStorage.setItem('molpath-session-v1', JSON.stringify(s));
  window.location.hash = `#/cases/${DEMO_001}/board`;
  const user = userEvent.setup();
  render(<App gateway={gateway} queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })} />);
  await screen.findByRole('toolbar', { name: 'Controles de la pizarra' }, { timeout: 5000 });
  return user;
}

afterEach(() => { window.__mobile = false; });

describe('Pizarra Molecular', () => {
  it('alterna Ruta principal / Ver todo y permite enfocar y salir de enfoque', async () => {
    const user = await openBoard();
    const main = screen.getByRole('button', { name: /Ruta principal/ });
    expect(main).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /Mostrar relaciones secundarias/ }));
    expect(screen.getByRole('button', { name: 'Ver todo' })).toHaveAttribute('aria-pressed', 'true');

    const outline = screen.getByRole('list', { name: 'Nodos del grafo' });
    await user.click(within(outline).getByText('EGFR p.L858R'));
    await user.click(await screen.findByRole('button', { name: /^Enfocar/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Enfocado en');
    await user.click(screen.getAllByRole('button', { name: 'Salir de enfoque' })[0]);
    expect(screen.queryByText(/Enfocado en/)).not.toBeInTheDocument();
  });

  it('explica la ruta de una variante sólo con datos registrados y muestra el resumen de evidencia', async () => {
    const user = await openBoard();
    await user.click(within(screen.getByRole('list', { name: 'Nodos del grafo' })).getByText('TP53 p.R273H'));
    await user.click(await screen.findByRole('button', { name: /Explicar esta ruta/ }));
    expect(await screen.findByText(/Esta variante fue detectada mediante NGS ADN/)).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.className === 'es-total' && el.textContent === '2 evidencia(s) vigente(s)')).toBeInTheDocument();
  });

  it('en móvil el detalle aparece en un bottom sheet que se puede minimizar, expandir y cerrar', async () => {
    const user = await openBoard(true);
    expect(screen.queryByRole('complementary', { name: 'Detalle del nodo' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lista de nodos' }));
    let sheet = await screen.findByRole('dialog', { name: 'Lista de nodos' });
    await user.click(within(sheet).getByText('EGFR p.L858R'));
    sheet = await screen.findByRole('dialog', { name: /Detalle: Variante EGFR p\.L858R/ });
    expect(sheet.className).toContain('half');
    await user.click(within(sheet).getByRole('button', { name: 'Ampliar panel' }));
    expect(sheet.className).toContain('full');
    await user.click(within(sheet).getByRole('button', { name: 'Minimizar panel' }));
    expect(sheet.className).toContain('min');
    await user.click(within(sheet).getByRole('button', { name: 'Cerrar panel' }));
    expect(screen.queryByRole('dialog', { name: /Detalle/ })).not.toBeInTheDocument();
  });
});
