import { useQuery } from '@tanstack/react-query';
import { useGateway } from '../../data/GatewayProvider';
import { CLINICAL_EDITOR_ROLES } from '../../domain/labels';

export function useCaseBoard(caseId: string | undefined) {
  const { gateway } = useGateway();
  return useQuery({ queryKey: ['board', caseId], queryFn: () => gateway.getBoard(caseId!), enabled: !!caseId });
}

export function useCanEditClinical() {
  const { session } = useGateway();
  return !!session && CLINICAL_EDITOR_ROLES.includes(session.user.role);
}
