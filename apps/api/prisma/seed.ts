import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { addDays, todayIso, type SyncOperationInput } from '@agrovax/shared';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ensureDefaultPlans } from '../src/modules/plans/plan.service';
import { SyncService } from '../src/modules/sync/sync.service';

/**
 * Seed de dados DEMONSTRATIVOS. Pode ser executado varias vezes.
 *
 * Tudo o que e criado aqui e ficticio:
 * - a "Fazenda Demo AgroVax", seus lotes, animais e registros;
 * - o catalogo de doencas e sintomas, gravado com `isDemo = true`. Os textos
 *   das doencas sao marcadores de lugar, NAO informacao veterinaria;
 * - os alertas de vigilancia, tambem com `isDemo = true`.
 *
 * A senha do usuario demo vem de SEED_DEMO_PASSWORD; se ausente, uma senha
 * aleatoria e gerada e exibida uma unica vez.
 */
const DEMO_EMAIL = 'demo@agrovax.app';
const DEMO_FARM_NAME = 'Fazenda Demo AgroVax';
const PLACEHOLDER =
  'Conteúdo DEMO: texto de exemplo, sem validade técnica. Será substituído por conteúdo revisado por médico-veterinário.';

const prisma = new PrismaClient();

async function ensureDemoAccount(): Promise<{ userId: string; farmId: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { memberships: true },
  });
  if (existing?.memberships[0]) {
    return { userId: existing.id, farmId: existing.memberships[0].farmId };
  }

  const password = process.env.SEED_DEMO_PASSWORD || randomBytes(9).toString('base64url');
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'ENTERPRISE' } });
  const user = await prisma.user.create({
    data: {
      name: 'Produtor Demo',
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(password, 12),
      memberships: {
        create: {
          role: 'OWNER',
          farm: {
            create: {
              name: DEMO_FARM_NAME,
              subscription: { create: { planId: plan.id, status: 'ACTIVE' } },
            },
          },
        },
      },
    },
    include: { memberships: true },
  });

  console.log(`  E-mail: ${DEMO_EMAIL}`);
  console.log(
    process.env.SEED_DEMO_PASSWORD
      ? '  Senha:  (definida em SEED_DEMO_PASSWORD)'
      : `  Senha:  ${password}  (gerada agora; anote, ela nao sera exibida de novo)`,
  );
  return { userId: user.id, farmId: user.memberships[0]?.farmId as string };
}

async function seedCatalog(): Promise<void> {
  const symptoms = [
    ['febre', 'Febre'],
    ['tosse', 'Tosse'],
    ['perda-de-apetite', 'Perda de apetite'],
    ['claudicacao', 'Claudicação'],
    ['corrimento-nasal', 'Corrimento nasal'],
    ['feridas', 'Feridas'],
  ] as const;
  for (const [slug, name] of symptoms) {
    await prisma.symptom.upsert({ where: { slug }, update: {}, create: { slug, name, isDemo: true } });
  }

  // Nomes reais de doencas, usados apenas como itens da lista. Os campos de
  // conteudo ficam com o texto marcador e sem nivel de risco nem sintomas.
  const diseases = [
    ['raiva', 'Raiva', ['BOVINE', 'EQUINE']],
    ['brucelose', 'Brucelose', ['BOVINE']],
    ['tuberculose-bovina', 'Tuberculose bovina', ['BOVINE']],
    ['mormo', 'Mormo', ['EQUINE']],
    ['influenza-equina', 'Influenza equina', ['EQUINE']],
    ['encefalomielite-equina', 'Encefalomielite equina', ['EQUINE']],
  ] as const;
  for (const [slug, name, species] of diseases) {
    await prisma.disease.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        species: [...species],
        causativeAgent: PLACEHOLDER,
        transmission: PLACEHOLDER,
        mainSymptoms: PLACEHOLDER,
        prevention: PLACEHOLDER,
        availableVaccines: PLACEHOLDER,
        preventiveMedications: PLACEHOLDER,
        source: 'DEMO AgroVax',
        isDemo: true,
      },
    });
  }

  // Doenca inteiramente ficticia, para demonstrar a relacao sintoma -> doenca
  // sem atribuir sintomas a doencas reais.
  const example = await prisma.disease.upsert({
    where: { slug: 'doenca-exemplo-demo' },
    update: {},
    create: {
      slug: 'doenca-exemplo-demo',
      name: 'Doença Exemplo (fictícia)',
      species: ['BOVINE', 'EQUINE'],
      causativeAgent: PLACEHOLDER,
      transmission: PLACEHOLDER,
      mainSymptoms: PLACEHOLDER,
      prevention: PLACEHOLDER,
      availableVaccines: PLACEHOLDER,
      preventiveMedications: PLACEHOLDER,
      riskLevel: 'MEDIUM',
      source: 'DEMO AgroVax',
      isDemo: true,
    },
  });
  const linked = await prisma.symptom.findMany({ where: { slug: { in: ['febre', 'tosse'] } } });
  for (const symptom of linked) {
    await prisma.diseaseSymptom.upsert({
      where: { diseaseId_symptomId: { diseaseId: example.id, symptomId: symptom.id } },
      update: {},
      create: { diseaseId: example.id, symptomId: symptom.id },
    });
  }

  if ((await prisma.surveillanceAlert.count({ where: { isDemo: true } })) === 0) {
    const today = todayIso();
    await prisma.surveillanceAlert.createMany({
      data: [
        {
          diseaseId: example.id,
          diseaseName: 'Doença Exemplo (fictícia)',
          state: 'MG',
          region: 'Região DEMO - MG',
          reportedAt: new Date(`${addDays(today, -3)}T00:00:00.000Z`),
          riskLevel: 'HIGH',
          description: 'Alerta fictício, criado apenas para demonstrar a tela de vigilância. Não representa um surto real.',
          guidance: 'Orientação fictícia de demonstração. Em situação real, siga a orientação do órgão de defesa sanitária e do médico-veterinário.',
          sourceName: 'DEMO AgroVax (dado fictício)',
          isDemo: true,
        },
        {
          diseaseId: example.id,
          diseaseName: 'Doença Exemplo (fictícia)',
          state: null,
          region: 'Região DEMO - nacional',
          reportedAt: new Date(`${addDays(today, -20)}T00:00:00.000Z`),
          riskLevel: 'LOW',
          description: 'Segundo alerta fictício de demonstração. Não representa um surto real.',
          guidance: 'Orientação fictícia de demonstração.',
          sourceName: 'DEMO AgroVax (dado fictício)',
          isDemo: true,
        },
      ],
    });
  }
}

async function seedFarmData(userId: string, farmId: string): Promise<void> {
  if ((await prisma.lot.count({ where: { farmId } })) > 0) {
    console.log('  Dados da fazenda demo ja existem.');
    return;
  }
  await prisma.farm.update({ where: { id: farmId }, data: { city: 'Cidade DEMO', state: 'MG' } });

  const today = todayIso();
  const operations: SyncOperationInput[] = [];
  const add = (entity: SyncOperationInput['entity'], changes: Record<string, unknown>): string => {
    const recordId = randomUUID();
    operations.push({ opId: randomUUID(), entity, recordId, action: 'UPSERT', baseVersion: 0, changes });
    return recordId;
  };

  const lot = (name: string, declaredQuantity: number, extra: Record<string, unknown>) =>
    add('lot', {
      name,
      declaredQuantity,
      species: 'BOVINE',
      category: null,
      purpose: null,
      ageRange: null,
      location: null,
      notes: 'Lote DEMO',
      ...extra,
    });
  const bezerros = lot('Bezerros 2026', 2000, { category: 'CALF', purpose: 'BEEF', ageRange: '0 a 8 meses', location: 'Pasto 3' });
  const leiteiras = lot('Vacas Leiteiras', 120, { category: 'COW', purpose: 'DAIRY', ageRange: 'Acima de 3 anos', location: 'Piquete do curral' });
  const recria = lot('Recria', 350, { category: 'STEER', purpose: 'BEEF', ageRange: '8 a 18 meses', location: 'Pasto 7' });

  const animal = (tag: string, name: string, extra: Record<string, unknown>) =>
    add('animal', {
      lotId: null,
      tag,
      name,
      species: 'BOVINE',
      sex: 'MALE',
      birthDate: null,
      breed: null,
      category: null,
      purpose: null,
      ownerName: 'Produtor Demo',
      status: 'ACTIVE',
      notes: 'Animal DEMO',
      ...extra,
    });
  const touro = animal('T-001', 'Soberano', { category: 'BULL', purpose: 'BEEF', breed: 'Nelore', birthDate: '2021-03-15' });
  animal('T-002', 'Trovão', { category: 'BULL', purpose: 'BEEF', breed: 'Nelore', birthDate: '2020-08-02' });
  const vaca = animal('V-101', 'Mimosa', { sex: 'FEMALE', category: 'COW', purpose: 'DAIRY', breed: 'Girolando', lotId: leiteiras, birthDate: '2019-05-20' });
  animal('V-102', 'Estrela', { sex: 'FEMALE', category: 'COW', purpose: 'DAIRY', breed: 'Girolando', lotId: leiteiras, birthDate: '2020-01-11' });
  const cavalo = animal('E-01', 'Relâmpago', { species: 'EQUINE', category: 'HORSE', breed: 'Mangalarga', birthDate: '2018-10-05' });
  animal('E-02', 'Princesa', { species: 'EQUINE', sex: 'FEMALE', category: 'MARE', breed: 'Mangalarga', birthDate: '2017-12-01' });
  animal('E-03', 'Faísca', { species: 'EQUINE', category: 'FOAL', breed: 'Quarto de Milha', birthDate: '2025-09-18' });

  const vaccination = (target: Record<string, unknown>, vaccineName: string, appliedAt: string, nextDoseAt: string | null, parentId: string | null = null) =>
    add('vaccination', {
      animalId: null,
      lotId: null,
      parentId,
      vaccineName,
      appliedAt,
      nextDoseAt,
      responsible: 'Produtor Demo',
      notes: 'Registro DEMO',
      ...target,
    });
  // Reforco proximo (10 dias), vacinacao atrasada (5 dias) e uma em dia.
  vaccination({ lotId: bezerros }, 'Vacina DEMO A', addDays(today, -170), addDays(today, 10));
  vaccination({ lotId: recria }, 'Vacina DEMO B', addDays(today, -185), addDays(today, -5));
  const lotVaccination = vaccination({ lotId: leiteiras }, 'Vacina DEMO A', addDays(today, -30), addDays(today, 150));
  vaccination({ animalId: vaca }, 'Vacina DEMO A', addDays(today, -30), addDays(today, 150), lotVaccination);
  vaccination({ animalId: touro }, 'Vacina DEMO C', addDays(today, -340), addDays(today, 25));
  vaccination({ animalId: cavalo }, 'Vacina DEMO D', addDays(today, -12), addDays(today, 353));

  const treatment = (target: Record<string, unknown>, type: string, product: string, appliedAt: string, nextApplicationAt: string | null) =>
    add('treatment', {
      animalId: null,
      lotId: null,
      parentId: null,
      type,
      product,
      appliedAt,
      nextApplicationAt,
      responsible: 'Produtor Demo',
      notes: 'Registro DEMO',
      ...target,
    });
  treatment({ lotId: leiteiras }, 'DEWORMER', 'Vermífugo DEMO', addDays(today, -80), addDays(today, 10));
  treatment({ lotId: bezerros }, 'TICK_CONTROL', 'Carrapaticida DEMO', addDays(today, -20), addDays(today, 40));
  treatment({ animalId: cavalo }, 'FLY_CONTROL', 'Mosquicida DEMO', addDays(today, -50), addDays(today, -2));

  const tosse = await prisma.symptom.findUnique({ where: { slug: 'tosse' } });
  add('symptomRecord', {
    animalId: cavalo,
    lotId: null,
    symptomId: tosse?.id ?? null,
    symptomName: 'Tosse',
    observedAt: addDays(today, -2),
    intensity: 'MILD',
    responsible: 'Produtor Demo',
    notes: 'Registro DEMO',
  });
  add('healthEvent', {
    animalId: touro,
    lotId: null,
    type: 'VET_VISIT',
    title: 'Visita de rotina (DEMO)',
    description: 'Evento DEMO',
    occurredAt: addDays(today, -45),
    responsible: 'Produtor Demo',
  });

  // Os dados entram pelo mesmo caminho da sincronizacao do app, o que mantem
  // versoes e sequencia consistentes.
  const { results } = await new SyncService(prisma).push(farmId, userId, {
    deviceId: 'seed',
    operations,
  });
  const failed = results.filter((result) => result.result === 'REJECTED');
  if (failed.length > 0) throw new Error(`Seed rejeitado: ${JSON.stringify(failed[0])}`);
  console.log(`  ${results.length} registros DEMO criados na fazenda.`);
}

async function main(): Promise<void> {
  console.log('Seed DEMO do AgroVax');
  await ensureDefaultPlans(prisma);
  const { userId, farmId } = await ensureDemoAccount();

  // A fazenda demo usa o plano sem limites para exibir todos os recursos.
  const enterprise = await prisma.plan.findUniqueOrThrow({ where: { code: 'ENTERPRISE' } });
  await prisma.subscription.update({ where: { farmId }, data: { planId: enterprise.id } });

  await seedCatalog();
  await seedFarmData(userId, farmId);
  console.log(`  Fazenda: ${DEMO_FARM_NAME}`);
  console.log('Concluido. Todo o conteudo criado e ficticio (DEMO).');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
