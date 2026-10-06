import {
  ENTITY_NAMES,
  entityFields,
  MAX_PULL_LIMIT,
  TARGETED_ENTITIES,
  validateEntityData,
  type EntityName,
  type PlanLimits,
  type SyncChange,
  type SyncOperationInput,
  type SyncOperationResult,
  type SyncPullResponse,
  type SyncPushInput,
  type SyncPushResponse,
  type SyncResultName,
} from '@agrovax/shared';
import { Prisma, type PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';
import { dataToColumns, delegateFor, rowToData, rowToRecord, type SyncRow } from './sync.mapping';

type Tx = Prisma.TransactionClient;

interface PushContext {
  farmId: string;
  userId: string;
  deviceId: string;
  limits: PlanLimits;
  /** Registros ja alterados neste mesmo envio (nao contam como conflito). */
  touched: Set<string>;
}

interface Outcome {
  result: SyncResultName;
  code?: string;
  message?: string;
  row?: SyncRow | null;
  /** Valores sobrescritos, guardados para auditoria em caso de conflito. */
  previous?: Record<string, unknown>;
}

const rejected = (code: string, message: string): Outcome => ({ result: 'REJECTED', code, message });


export class SyncService {
  constructor(private readonly db: PrismaClient) {}

  // ------------------------------------------------------------------ push

  /**
   * Aplica as operacoes na ordem recebida. Cada operacao tem transacao
   * propria: uma falha nao desfaz as anteriores (sincronizacao parcial).
   */
  async push(farmId: string, userId: string, input: SyncPushInput): Promise<SyncPushResponse> {
    const context: PushContext = {
      farmId,
      userId,
      deviceId: input.deviceId,
      limits: await this.loadLimits(farmId),
      touched: new Set(),
    };

    const results: SyncOperationResult[] = [];
    for (const operation of input.operations) {
      results.push(await this.applyOne(context, operation));
    }
    return { results };
  }

  private async applyOne(context: PushContext, op: SyncOperationInput): Promise<SyncOperationResult> {
    try {
      const outcome = await this.db.$transaction(async (tx) => {
        const replay = await this.findReplay(tx, context.farmId, op);
        if (replay) return replay;

        const result = await this.apply(tx, context, op);
        await tx.syncOperation.create({
          data: {
            id: op.opId,
            farmId: context.farmId,
            userId: context.userId,
            deviceId: context.deviceId,
            entity: op.entity,
            recordId: op.recordId,
            action: op.action,
            result: result.result,
            detail: {
              ...(result.code ? { code: result.code } : {}),
              ...(result.message ? { message: result.message } : {}),
              ...(result.previous ? { previous: result.previous as Prisma.InputJsonObject } : {}),
            },
          },
        });
        return result;
      });

      if (outcome.result !== 'REJECTED') context.touched.add(op.recordId);
      return this.toResult(op, outcome);
    } catch (error) {
      // O mesmo opId chegou duas vezes ao mesmo tempo: devolve o resultado ja gravado.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.findReplay(this.db, context.farmId, op);
        if (replay) return this.toResult(op, replay);
      }
      logger.error({ err: error, opId: op.opId, entity: op.entity }, 'falha ao aplicar operacao');
      // Nao e gravada em SyncOperation: o aparelho pode tentar de novo.
      return {
        opId: op.opId,
        result: 'REJECTED',
        code: 'INTERNAL',
        message: 'Erro interno ao sincronizar. Será feita nova tentativa.',
      };
    }
  }

  /** Operacao ja processada antes (reenvio): devolve o mesmo resultado, sem reaplicar. */
  private async findReplay(
    client: Tx,
    farmId: string,
    op: SyncOperationInput,
  ): Promise<Outcome | null> {
    const stored = await client.syncOperation.findUnique({ where: { id: op.opId } });
    if (!stored) return null;
    if (stored.farmId !== farmId) {
      return rejected('INVALID_OPERATION', 'Operação inválida.');
    }
    const detail = (stored.detail ?? {}) as { code?: string; message?: string };
    const row = await delegateFor(client, op.entity).findUnique({ where: { id: op.recordId } });
    return { result: stored.result, code: detail.code, message: detail.message, row };
  }

  private async apply(tx: Tx, context: PushContext, op: SyncOperationInput): Promise<Outcome> {
    const delegate = delegateFor(tx, op.entity);
    const row = await delegate.findUnique({ where: { id: op.recordId } });

    // O id pertence a outra fazenda: nunca revelar nem alterar.
    if (row && row.farmId !== context.farmId) {
      return rejected('INVALID_RECORD', 'Registro inválido.');
    }

    if (op.action === 'DELETE') {
      if (!row || row.deletedAt) return { result: 'APPLIED', row };
      const deleted = await delegate.update({
        where: { id: row.id },
        data: {
          deletedAt: new Date(),
          version: row.version + 1,
          syncSeq: await this.nextSeq(tx, context.farmId),
        },
      });
      return { result: 'APPLIED', row: deleted };
    }

    if (row?.deletedAt) {
      return rejected('RECORD_DELETED', 'Este registro foi excluído em outro aparelho.');
    }

    const fields = entityFields(op.entity);
    const changes: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in op.changes) changes[field] = op.changes[field];
    }

    const current = row ? rowToData(op.entity, row) : {};
    const validation = validateEntityData(op.entity, { ...current, ...changes });
    if (!validation.ok || !validation.data) {
      const first = Object.values(validation.errors ?? {})[0];
      return rejected('VALIDATION', first ?? 'Dados inválidos.');
    }
    const data = validation.data as Record<string, unknown>;

    const referenceError = await this.checkReferences(tx, context.farmId, op.entity, data);
    if (referenceError) return rejected('INVALID_REFERENCE', referenceError);

    if (!row) {
      const limitError = await this.checkPlanLimit(tx, context, op.entity);
      if (limitError) return rejected('PLAN_LIMIT', limitError);

      const created = await delegate.create({
        data: {
          ...dataToColumns(op.entity, data),
          id: op.recordId,
          farmId: context.farmId,
          version: 1,
          syncSeq: await this.nextSeq(tx, context.farmId),
        },
      });
      return { result: 'APPLIED', row: created };
    }

    // Base desatualizada: outra origem alterou o registro depois que este
    // aparelho o leu. A alteracao e aplicada campo a campo (os demais campos
    // do servidor sao preservados) e os valores sobrescritos ficam registrados.
    const stale = op.baseVersion < row.version && !context.touched.has(row.id);
    const previous: Record<string, unknown> = {};
    for (const field of Object.keys(changes)) {
      if (JSON.stringify(current[field]) !== JSON.stringify(data[field])) {
        previous[field] = current[field];
      }
    }
    const overwrote = stale && Object.keys(previous).length > 0;

    const changedColumns = dataToColumns(
      op.entity,
      Object.fromEntries(Object.keys(changes).map((field) => [field, data[field]])),
    );
    const updated = await delegate.update({
      where: { id: row.id },
      data: {
        ...changedColumns,
        version: row.version + 1,
        syncSeq: await this.nextSeq(tx, context.farmId),
      },
    });

    return overwrote
      ? {
          result: 'CONFLICT',
          code: 'OVERWRITE',
          message: 'O registro também foi alterado em outro aparelho. Sua alteração foi aplicada por último.',
          row: updated,
          previous,
        }
      : { result: 'APPLIED', row: updated };
  }

  /**
   * Incrementa o contador da fazenda. O UPDATE bloqueia a linha da fazenda ate
   * o fim da transacao, o que coloca as alteracoes de uma fazenda em ordem total.
   */
  private async nextSeq(tx: Tx, farmId: string): Promise<bigint> {
    const farm = await tx.farm.update({
      where: { id: farmId },
      data: { syncSeq: { increment: 1 } },
      select: { syncSeq: true },
    });
    return farm.syncSeq;
  }

  /** Garante que os registros referenciados existem e sao da mesma fazenda. */
  private async checkReferences(
    tx: Tx,
    farmId: string,
    entity: EntityName,
    data: Record<string, unknown>,
  ): Promise<string | null> {
    const exists = async (target: EntityName, id: unknown): Promise<boolean> => {
      if (typeof id !== 'string') return true;
      const found = await delegateFor(tx, target).findUnique({ where: { id } });
      return found !== null && found.farmId === farmId && found.deletedAt === null;
    };

    if (entity === 'animal' && !(await exists('lot', data.lotId))) {
      return 'O lote informado não existe mais.';
    }
    if (TARGETED_ENTITIES.includes(entity)) {
      if (!(await exists('animal', data.animalId))) return 'O animal informado não existe mais.';
      if (!(await exists('lot', data.lotId))) return 'O lote informado não existe mais.';
    }
    if ((entity === 'vaccination' || entity === 'treatment') && !(await exists(entity, data.parentId))) {
      return 'O registro do lote que originou este registro não existe mais.';
    }
    if (entity === 'symptomRecord' && typeof data.symptomId === 'string') {
      const symptom = await tx.symptom.findUnique({ where: { id: data.symptomId } });
      // Sintoma removido do catalogo: mantem o registro apenas com o nome.
      if (!symptom) data.symptomId = null;
    }
    return null;
  }

  private async checkPlanLimit(tx: Tx, context: PushContext, entity: EntityName): Promise<string | null> {
    const limit =
      entity === 'animal' ? context.limits.maxAnimals : entity === 'lot' ? context.limits.maxLots : null;
    if (limit === null || limit === undefined) return null;

    const used = await delegateFor(tx, entity).count({
      where: { farmId: context.farmId, deletedAt: null },
    });
    if (used < limit) return null;
    return entity === 'animal'
      ? `Seu plano permite até ${limit} animais cadastrados individualmente.`
      : `Seu plano permite até ${limit} lotes.`;
  }

  private async loadLimits(farmId: string): Promise<PlanLimits> {
    const subscription = await this.db.subscription.findUnique({
      where: { farmId },
      include: { plan: true },
    });
    const unlimited: PlanLimits = { maxAnimals: null, maxLots: null, maxUsers: null };
    return subscription ? (subscription.plan.limits as unknown as PlanLimits) : unlimited;
  }

  private toResult(op: SyncOperationInput, outcome: Outcome): SyncOperationResult {
    return {
      opId: op.opId,
      result: outcome.result,
      ...(outcome.code ? { code: outcome.code } : {}),
      ...(outcome.message ? { message: outcome.message } : {}),
      ...(outcome.row ? { record: rowToRecord(op.entity, outcome.row) } : {}),
    };
  }

  // ------------------------------------------------------------------ pull

  /** Devolve, em ordem, os registros da fazenda alterados depois do cursor. */
  async pull(farmId: string, cursor: number, requestedLimit: number): Promise<SyncPullResponse> {
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_PULL_LIMIT);

    const perEntity = await Promise.all(
      ENTITY_NAMES.map(async (entity) => {
        const rows = await delegateFor(this.db, entity).findMany({
          where: { farmId, syncSeq: { gt: BigInt(cursor) } },
          orderBy: { syncSeq: 'asc' },
          take: limit + 1,
        });
        return rows.map((row) => ({ entity, row }));
      }),
    );

    // Cada consulta trouxe as menores sequencias da sua tabela; a intercalacao
    // das listas e, portanto, a sequencia correta da fazenda.
    const merged = perEntity.flat().sort((a, b) => (a.row.syncSeq < b.row.syncSeq ? -1 : 1));
    const page = merged.slice(0, limit);
    const last = page[page.length - 1];

    const changes: SyncChange[] = page.map(({ entity, row }) => ({
      entity,
      record: rowToRecord(entity, row),
    }));
    return {
      changes,
      cursor: last ? Number(last.row.syncSeq) : cursor,
      hasMore: merged.length > limit,
    };
  }
}
