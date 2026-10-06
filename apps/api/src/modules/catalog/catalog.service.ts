import { createHash } from 'node:crypto';
import type {
  CatalogDto,
  CatalogResponse,
  DiseaseDto,
  SurveillanceAlertDto,
  SymptomDto,
} from '@agrovax/shared';
import type { Disease, DiseaseSymptom, PrismaClient, SurveillanceAlert, Symptom } from '@prisma/client';

export function toDiseaseDto(disease: Disease & { symptoms: DiseaseSymptom[] }): DiseaseDto {
  return {
    id: disease.id,
    slug: disease.slug,
    name: disease.name,
    species: disease.species,
    causativeAgent: disease.causativeAgent,
    transmission: disease.transmission,
    mainSymptoms: disease.mainSymptoms,
    prevention: disease.prevention,
    availableVaccines: disease.availableVaccines,
    preventiveMedications: disease.preventiveMedications,
    riskLevel: disease.riskLevel,
    source: disease.source,
    isDemo: disease.isDemo,
    symptomIds: disease.symptoms.map((link) => link.symptomId),
  };
}

export function toSymptomDto(symptom: Symptom): SymptomDto {
  return { id: symptom.id, slug: symptom.slug, name: symptom.name, isDemo: symptom.isDemo };
}

export function toSurveillanceDto(alert: SurveillanceAlert): SurveillanceAlertDto {
  return {
    id: alert.id,
    diseaseId: alert.diseaseId,
    diseaseName: alert.diseaseName,
    state: alert.state,
    region: alert.region,
    reportedAt: alert.reportedAt.toISOString().slice(0, 10),
    riskLevel: alert.riskLevel,
    description: alert.description,
    guidance: alert.guidance,
    sourceName: alert.sourceName,
    sourceUrl: alert.sourceUrl,
    isDemo: alert.isDemo,
  };
}

/**
 * Catalogos globais lidos pelo app: biblioteca de doencas, sintomas e alertas
 * de vigilancia. Sao pequenos, entao o app baixa o conjunto inteiro, mas so
 * quando a `version` muda.
 */
export class CatalogService {
  constructor(private readonly db: PrismaClient) {}

  async get(knownVersion?: string): Promise<CatalogResponse> {
    const [diseases, symptoms, alerts] = await Promise.all([
      this.db.disease.findMany({
        where: { published: true },
        include: { symptoms: true },
        orderBy: { name: 'asc' },
      }),
      this.db.symptom.findMany({ orderBy: { name: 'asc' } }),
      this.db.surveillanceAlert.findMany({
        where: { active: true },
        orderBy: { reportedAt: 'desc' },
      }),
    ]);

    const catalog: Omit<CatalogDto, 'version'> = {
      diseases: diseases.map(toDiseaseDto),
      symptoms: symptoms.map(toSymptomDto),
      surveillanceAlerts: alerts.map(toSurveillanceDto),
    };
    const version = createHash('sha256').update(JSON.stringify(catalog)).digest('hex').slice(0, 16);

    return version === knownVersion ? { version, unchanged: true } : { version, ...catalog };
  }
}
