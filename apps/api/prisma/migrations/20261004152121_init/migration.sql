-- CreateEnum
CREATE TYPE "Species" AS ENUM ('BOVINE', 'EQUINE');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('ACTIVE', 'SOLD', 'DEAD', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "Purpose" AS ENUM ('BEEF', 'DAIRY');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('CALF', 'HEIFER', 'COW', 'BULL', 'STEER', 'HORSE', 'MARE', 'FOAL', 'STALLION');

-- CreateEnum
CREATE TYPE "TreatmentType" AS ENUM ('DEWORMER', 'TICK_CONTROL', 'FLY_CONTROL', 'OTHER');

-- CreateEnum
CREATE TYPE "SymptomIntensity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "HealthEventType" AS ENUM ('EXAM', 'VET_VISIT', 'NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('VACCINATION_DUE', 'VACCINATION_OVERDUE', 'TREATMENT_DUE', 'TREATMENT_OVERDUE');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'MANAGER', 'WORKER');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SyncAction" AS ENUM ('UPSERT', 'DELETE');

-- CreateEnum
CREATE TYPE "SyncResult" AS ENUM ('APPLIED', 'CONFLICT', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" CHAR(2),
    "syncSeq" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "limits" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "provider" TEXT,
    "providerCustomerId" TEXT,
    "providerSubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "lotId" UUID,
    "tag" TEXT NOT NULL,
    "name" TEXT,
    "species" "Species" NOT NULL,
    "sex" "Sex" NOT NULL,
    "birthDate" DATE,
    "breed" TEXT,
    "category" "Category",
    "purpose" "Purpose",
    "ownerName" TEXT,
    "status" "AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "syncSeq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalPhoto" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "animalId" UUID NOT NULL,
    "storageKey" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "syncSeq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "AnimalPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "declaredQuantity" INTEGER NOT NULL,
    "species" "Species" NOT NULL,
    "category" "Category",
    "purpose" "Purpose",
    "ageRange" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "syncSeq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "animalId" UUID,
    "lotId" UUID,
    "parentId" UUID,
    "vaccineName" TEXT NOT NULL,
    "appliedAt" DATE NOT NULL,
    "nextDoseAt" DATE,
    "responsible" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "syncSeq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreventiveTreatment" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "animalId" UUID,
    "lotId" UUID,
    "parentId" UUID,
    "type" "TreatmentType" NOT NULL,
    "product" TEXT NOT NULL,
    "appliedAt" DATE NOT NULL,
    "nextApplicationAt" DATE,
    "responsible" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "syncSeq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "PreventiveTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymptomRecord" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "animalId" UUID,
    "lotId" UUID,
    "symptomId" UUID,
    "symptomName" TEXT NOT NULL,
    "observedAt" DATE NOT NULL,
    "intensity" "SymptomIntensity",
    "responsible" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "syncSeq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "SymptomRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthEvent" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "animalId" UUID,
    "lotId" UUID,
    "type" "HealthEventType" NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" DATE NOT NULL,
    "responsible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "syncSeq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "HealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "animalId" UUID,
    "lotId" UUID,
    "kind" "AlertKind" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sourceId" UUID NOT NULL,
    "dueDate" DATE NOT NULL,
    "thresholdDays" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "syncSeq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disease" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "Species"[],
    "causativeAgent" TEXT,
    "transmission" TEXT,
    "mainSymptoms" TEXT,
    "prevention" TEXT,
    "availableVaccines" TEXT,
    "preventiveMedications" TEXT,
    "riskLevel" "RiskLevel",
    "source" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Symptom" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Symptom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseSymptom" (
    "diseaseId" UUID NOT NULL,
    "symptomId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiseaseSymptom_pkey" PRIMARY KEY ("diseaseId","symptomId")
);

-- CreateTable
CREATE TABLE "SurveillanceAlert" (
    "id" UUID NOT NULL,
    "diseaseId" UUID,
    "diseaseName" TEXT NOT NULL,
    "state" CHAR(2),
    "region" TEXT NOT NULL,
    "reportedAt" DATE NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "description" TEXT NOT NULL,
    "guidance" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "providerKey" TEXT,
    "externalId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveillanceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOperation" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "recordId" UUID NOT NULL,
    "action" "SyncAction" NOT NULL,
    "result" "SyncResult" NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Membership_farmId_idx" ON "Membership"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_farmId_key" ON "Membership"("userId", "farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_farmId_key" ON "Subscription"("farmId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Animal_farmId_syncSeq_idx" ON "Animal"("farmId", "syncSeq");

-- CreateIndex
CREATE INDEX "Animal_farmId_tag_idx" ON "Animal"("farmId", "tag");

-- CreateIndex
CREATE INDEX "Animal_farmId_species_idx" ON "Animal"("farmId", "species");

-- CreateIndex
CREATE INDEX "Animal_lotId_idx" ON "Animal"("lotId");

-- CreateIndex
CREATE INDEX "AnimalPhoto_farmId_syncSeq_idx" ON "AnimalPhoto"("farmId", "syncSeq");

-- CreateIndex
CREATE INDEX "AnimalPhoto_animalId_idx" ON "AnimalPhoto"("animalId");

-- CreateIndex
CREATE INDEX "Lot_farmId_syncSeq_idx" ON "Lot"("farmId", "syncSeq");

-- CreateIndex
CREATE INDEX "Lot_farmId_species_idx" ON "Lot"("farmId", "species");

-- CreateIndex
CREATE INDEX "Vaccination_farmId_syncSeq_idx" ON "Vaccination"("farmId", "syncSeq");

-- CreateIndex
CREATE INDEX "Vaccination_farmId_nextDoseAt_idx" ON "Vaccination"("farmId", "nextDoseAt");

-- CreateIndex
CREATE INDEX "Vaccination_animalId_idx" ON "Vaccination"("animalId");

-- CreateIndex
CREATE INDEX "Vaccination_lotId_idx" ON "Vaccination"("lotId");

-- CreateIndex
CREATE INDEX "Vaccination_parentId_idx" ON "Vaccination"("parentId");

-- CreateIndex
CREATE INDEX "PreventiveTreatment_farmId_syncSeq_idx" ON "PreventiveTreatment"("farmId", "syncSeq");

-- CreateIndex
CREATE INDEX "PreventiveTreatment_farmId_nextApplicationAt_idx" ON "PreventiveTreatment"("farmId", "nextApplicationAt");

-- CreateIndex
CREATE INDEX "PreventiveTreatment_animalId_idx" ON "PreventiveTreatment"("animalId");

-- CreateIndex
CREATE INDEX "PreventiveTreatment_lotId_idx" ON "PreventiveTreatment"("lotId");

-- CreateIndex
CREATE INDEX "PreventiveTreatment_parentId_idx" ON "PreventiveTreatment"("parentId");

-- CreateIndex
CREATE INDEX "SymptomRecord_farmId_syncSeq_idx" ON "SymptomRecord"("farmId", "syncSeq");

-- CreateIndex
CREATE INDEX "SymptomRecord_animalId_idx" ON "SymptomRecord"("animalId");

-- CreateIndex
CREATE INDEX "SymptomRecord_lotId_idx" ON "SymptomRecord"("lotId");

-- CreateIndex
CREATE INDEX "HealthEvent_farmId_syncSeq_idx" ON "HealthEvent"("farmId", "syncSeq");

-- CreateIndex
CREATE INDEX "HealthEvent_animalId_idx" ON "HealthEvent"("animalId");

-- CreateIndex
CREATE INDEX "HealthEvent_lotId_idx" ON "HealthEvent"("lotId");

-- CreateIndex
CREATE INDEX "Alert_farmId_syncSeq_idx" ON "Alert"("farmId", "syncSeq");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_farmId_dedupeKey_key" ON "Alert"("farmId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Disease_slug_key" ON "Disease"("slug");

-- CreateIndex
CREATE INDEX "Disease_updatedAt_idx" ON "Disease"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Symptom_slug_key" ON "Symptom"("slug");

-- CreateIndex
CREATE INDEX "Symptom_updatedAt_idx" ON "Symptom"("updatedAt");

-- CreateIndex
CREATE INDEX "DiseaseSymptom_symptomId_idx" ON "DiseaseSymptom"("symptomId");

-- CreateIndex
CREATE INDEX "SurveillanceAlert_updatedAt_idx" ON "SurveillanceAlert"("updatedAt");

-- CreateIndex
CREATE INDEX "SurveillanceAlert_state_idx" ON "SurveillanceAlert"("state");

-- CreateIndex
CREATE UNIQUE INDEX "SurveillanceAlert_providerKey_externalId_key" ON "SurveillanceAlert"("providerKey", "externalId");

-- CreateIndex
CREATE INDEX "SyncOperation_farmId_createdAt_idx" ON "SyncOperation"("farmId", "createdAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPhoto" ADD CONSTRAINT "AnimalPhoto_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPhoto" ADD CONSTRAINT "AnimalPhoto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Vaccination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveTreatment" ADD CONSTRAINT "PreventiveTreatment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveTreatment" ADD CONSTRAINT "PreventiveTreatment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveTreatment" ADD CONSTRAINT "PreventiveTreatment_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveTreatment" ADD CONSTRAINT "PreventiveTreatment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PreventiveTreatment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomRecord" ADD CONSTRAINT "SymptomRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomRecord" ADD CONSTRAINT "SymptomRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomRecord" ADD CONSTRAINT "SymptomRecord_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomRecord" ADD CONSTRAINT "SymptomRecord_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "Symptom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseSymptom" ADD CONSTRAINT "DiseaseSymptom_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseSymptom" ADD CONSTRAINT "DiseaseSymptom_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "Symptom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveillanceAlert" ADD CONSTRAINT "SurveillanceAlert_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restricoes que o Prisma nao expressa no schema.
-- Cada registro sanitario pertence a um animal OU a um lote (exatamente um).
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_target_check"
  CHECK (("animalId" IS NOT NULL) <> ("lotId" IS NOT NULL));
ALTER TABLE "PreventiveTreatment" ADD CONSTRAINT "PreventiveTreatment_target_check"
  CHECK (("animalId" IS NOT NULL) <> ("lotId" IS NOT NULL));
ALTER TABLE "SymptomRecord" ADD CONSTRAINT "SymptomRecord_target_check"
  CHECK (("animalId" IS NOT NULL) <> ("lotId" IS NOT NULL));
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_target_check"
  CHECK (("animalId" IS NOT NULL) <> ("lotId" IS NOT NULL));
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_target_check"
  CHECK (("animalId" IS NOT NULL) <> ("lotId" IS NOT NULL));

-- A quantidade informada de um lote nunca e negativa.
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_declaredQuantity_check"
  CHECK ("declaredQuantity" >= 0);
