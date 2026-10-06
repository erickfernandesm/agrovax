import type {
  DiseaseInput,
  PlanCode,
  PlanUpdateInput,
  SubscriptionUpdateInput,
  SurveillanceInput,
  SymptomInput,
} from '@agrovax/shared';
import { Prisma, type PrismaClient } from '@prisma/client';
import { errors } from '../../lib/errors';
import { toDiseaseDto, toSurveillanceDto, toSymptomDto } from '../catalog/catalog.service';

function handleUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw errors.conflict('ALREADY_EXISTS', 'Já existe um registro com este identificador.');
    if (error.code === 'P2025') throw errors.notFound();
    if (error.code === 'P2003') throw errors.conflict('INVALID_REFERENCE', 'Registro relacionado não encontrado.');
  }
  throw error;
}

/** Operacoes do administrador da plataforma. */
export class AdminService {
  constructor(private readonly db: PrismaClient) {}

  // ------------------------------------------------------ usuarios e fazendas

  async listUsers() {
    const users = await this.db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        isPlatformAdmin: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
    });
    return users.map(({ _count, ...user }) => ({ ...user, farms: _count.memberships }));
  }

  async listFarms() {
    const farms = await this.db.farm.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { animals: true, lots: true, memberships: true } },
      },
    });
    return farms.map((farm) => ({
      id: farm.id,
      name: farm.name,
      city: farm.city,
      state: farm.state,
      createdAt: farm.createdAt,
      plan: farm.subscription?.plan.code ?? null,
      subscriptionStatus: farm.subscription?.status ?? null,
      expiresAt: farm.subscription?.expiresAt ?? null,
      animals: farm._count.animals,
      lots: farm._count.lots,
      users: farm._count.memberships,
    }));
  }

  // ------------------------------------------------------------- doencas

  async listDiseases() {
    const diseases = await this.db.disease.findMany({ include: { symptoms: true }, orderBy: { name: 'asc' } });
    return diseases.map((disease) => ({ ...toDiseaseDto(disease), published: disease.published }));
  }

  async createDisease(input: DiseaseInput) {
    const { symptomIds, ...data } = input;
    try {
      const disease = await this.db.disease.create({
        data: {
          ...data,
          symptoms: symptomIds ? { create: symptomIds.map((symptomId) => ({ symptomId })) } : undefined,
        },
        include: { symptoms: true },
      });
      return toDiseaseDto(disease);
    } catch (error) {
      handleUnique(error);
    }
  }

  async updateDisease(id: string, input: Partial<DiseaseInput>) {
    const { symptomIds, ...data } = input;
    try {
      const disease = await this.db.$transaction(async (tx) => {
        if (symptomIds) {
          await tx.diseaseSymptom.deleteMany({ where: { diseaseId: id } });
          await tx.diseaseSymptom.createMany({
            data: symptomIds.map((symptomId) => ({ diseaseId: id, symptomId })),
          });
        }
        return tx.disease.update({ where: { id }, data, include: { symptoms: true } });
      });
      return toDiseaseDto(disease);
    } catch (error) {
      handleUnique(error);
    }
  }

  async deleteDisease(id: string): Promise<void> {
    await this.db.disease.delete({ where: { id } }).catch(handleUnique);
  }

  // ------------------------------------------------------------ sintomas

  async listSymptoms() {
    return (await this.db.symptom.findMany({ orderBy: { name: 'asc' } })).map(toSymptomDto);
  }

  async createSymptom(input: SymptomInput) {
    return toSymptomDto(await this.db.symptom.create({ data: input }).catch(handleUnique));
  }

  async updateSymptom(id: string, input: Partial<SymptomInput>) {
    return toSymptomDto(await this.db.symptom.update({ where: { id }, data: input }).catch(handleUnique));
  }

  async deleteSymptom(id: string): Promise<void> {
    await this.db.symptom.delete({ where: { id } }).catch(handleUnique);
  }

  // ---------------------------------------------------------- vigilancia

  async listSurveillance() {
    const alerts = await this.db.surveillanceAlert.findMany({ orderBy: { reportedAt: 'desc' } });
    return alerts.map((alert) => ({ ...toSurveillanceDto(alert), active: alert.active }));
  }

  async createSurveillance(input: SurveillanceInput) {
    const { reportedAt, ...data } = input;
    const alert = await this.db.surveillanceAlert
      .create({ data: { ...data, reportedAt: new Date(`${reportedAt}T00:00:00.000Z`) } })
      .catch(handleUnique);
    return toSurveillanceDto(alert);
  }

  async updateSurveillance(id: string, input: Partial<SurveillanceInput>) {
    const { reportedAt, ...data } = input;
    const alert = await this.db.surveillanceAlert
      .update({
        where: { id },
        data: {
          ...data,
          ...(reportedAt ? { reportedAt: new Date(`${reportedAt}T00:00:00.000Z`) } : {}),
        },
      })
      .catch(handleUnique);
    return toSurveillanceDto(alert);
  }

  async deleteSurveillance(id: string): Promise<void> {
    await this.db.surveillanceAlert.delete({ where: { id } }).catch(handleUnique);
  }

  // -------------------------------------------------- planos e assinaturas

  listPlans() {
    return this.db.plan.findMany({ orderBy: { priceCents: 'asc' } });
  }

  async updatePlan(code: PlanCode, input: PlanUpdateInput) {
    return this.db.plan
      .update({
        where: { code },
        data: {
          ...input,
          limits: input.limits as Prisma.InputJsonValue | undefined,
        },
      })
      .catch(handleUnique);
  }

  async updateSubscription(farmId: string, input: SubscriptionUpdateInput) {
    const plan = input.plan ? await this.db.plan.findUnique({ where: { code: input.plan } }) : null;
    if (input.plan && !plan) throw errors.notFound('Plano não encontrado.');

    const subscription = await this.db.subscription
      .update({
        where: { farmId },
        data: {
          ...(plan ? { planId: plan.id } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.expiresAt !== undefined
            ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
            : {}),
        },
        include: { plan: true },
      })
      .catch(handleUnique);
    return {
      farmId,
      plan: subscription.plan.code,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
    };
  }
}
