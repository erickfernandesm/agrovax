import { EmptyState } from './Bits';
import { Screen } from './Screen';

/** Registro que nao existe mais neste aparelho (excluido aqui ou em outro aparelho). */
export function NotFound({ what }: { what: string }) {
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <EmptyState
        icon="help-circle-outline"
        title={`${what} não encontrado`}
        text="O registro pode ter sido excluído neste ou em outro aparelho."
      />
    </Screen>
  );
}
