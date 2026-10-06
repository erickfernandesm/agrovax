import type { CreateFarmInput, FarmDto, UpdateFarmInput } from '@agrovax/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { errors } from '../../lib/errors';
import { getFreePlan } from '../plans/plan.service';
import { membershipInclude, toFarmDto } from './farm.mapper';

export class FarmService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Cria a fazenda, o vinculo do dono e a assinatura gratuita.
   * Recebe o client para poder participar de uma transacao maior (cadastro).
   */
  async createForOwner(
    tx: Prisma.TransactionClient,
    userId: string,
    input: CreateFarmInput,
  ): Promise<string> {
    const plan = await getFreePlan(tx);
    const farm = await tx.farm.create({
      data: {
        name: input.name,
        city: input.city ?? null,
        state: input.state ?? null,
        memberships: { create: { userId, role: 'OWNER' } },
        subscription: { create: { planId: plan.id, status: 'ACTIVE' } },
      },
    });
    return farm.id;
  }

  async create(userId: string, input: CreateFarmInput): Promise<FarmDto> {
    const farmId = await this.db.$transaction((tx) => this.createForOwner(tx, userId, input));
    return this.getForUser(userId, farmId);
  }

  async listForUser(userId: string): Promise<FarmDto[]> {
    const memberships = await this.db.membership.findMany({
      where: { userId },
      include: membershipInclude,
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(toFarmDto);
  }

  async getForUser(userId: string, farmId: string): Promise<FarmDto> {
    const membership = await this.db.membership.findUnique({
      where: { userId_farmId: { userId, farmId } },
      include: membershipInclude,
    });
    if (!membership) throw errors.notFound('Fazenda não encontrada.');
    return toFarmDto(membership);
  }

  async update(userId: string, farmId: string, input: UpdateFarmInput): Promise<FarmDto> {
    await this.db.farm.update({
      where: { id: farmId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
      },
    });
    return this.getForUser(userId, farmId);
  }
}
