import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Loading } from '../components/ui';
import type { MolPathGateway } from '../data/gateway';
import { GatewayProvider, useGateway } from '../data/GatewayProvider';
import { CaseDetailPage } from '../features/cases/CaseDetailPage';
import { CaseCreatePage } from '../features/cases/CaseCreatePage';
import { CasesPage } from '../features/cases/CasesPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { DiscussionPage, CaseDiscussionPage } from '../features/discussion/DiscussionPages';
import { EvidencePage } from '../features/evidence/EvidencePage';
import { LearnPage } from '../features/learn/LearnPage';
import { LiteraturePage } from '../features/literature/LiteraturePage';
import { SearchPage } from '../features/search/SearchPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { CaseSnapshotsPage, SnapshotComparePage, SnapshotsPage } from '../features/snapshots/SnapshotPages';
import { TimelinePage } from '../features/timeline/TimelinePage';
import { Layout, NotFound } from './Layout';
import { LoginScreen } from './LoginScreen';

// La pizarra (React Flow + dagre) se carga bajo demanda.
const BoardPage = lazy(() => import('../features/board/BoardPage'));

function Routed() {
  const { session } = useGateway();
  if (!session) return <LoginScreen />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="cases/new" element={<CaseCreatePage />} />
        <Route path="cases/:caseId" element={<CaseDetailPage />} />
        <Route
          path="cases/:caseId/board"
          element={
            <Suspense fallback={<Loading label="Cargando la pizarra…" />}>
              <BoardPage />
            </Suspense>
          }
        />
        <Route path="cases/:caseId/timeline" element={<TimelinePage />} />
        <Route path="cases/:caseId/discussion" element={<CaseDiscussionPage />} />
        <Route path="cases/:caseId/snapshots" element={<CaseSnapshotsPage />} />
        <Route path="cases/:caseId/snapshots/:snapshotId" element={<SnapshotComparePage />} />
        <Route path="evidence" element={<EvidencePage />} />
        <Route path="literature" element={<LiteraturePage />} />
        <Route path="discussion" element={<DiscussionPage />} />
        <Route path="snapshots" element={<SnapshotsPage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App({ gateway, queryClient }: { gateway?: MolPathGateway; queryClient?: QueryClient }) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } });
  return (
    <QueryClientProvider client={client}>
      <GatewayProvider gateway={gateway}>
        <HashRouter>
          <Routed />
        </HashRouter>
      </GatewayProvider>
    </QueryClientProvider>
  );
}
