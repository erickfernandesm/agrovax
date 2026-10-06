import {
  identifiedInLot,
  type EntityData,
  type TreatmentRecord,
  type VaccinationRecord,
} from '@agrovax/shared';
import type { LocalStore } from './store/LocalStore';

/**
 * Regras de negocio das gravacoes do app. As telas chamam estas funcoes;
 * nenhuma tela monta registros ou fala com o banco diretamente.
 */

export type HealthTarget = { type: 'animal'; id: string } | { type: 'lot'; id: string };

function targetFields(target: HealthTarget): { animalId: string | null; lotId: string | null } {
  return target.type === 'animal'
    ? { animalId: target.id, lotId: null }
    : { animalId: null, lotId: target.id };
}

export type VaccinationInput = Omit<EntityData['vaccination'], 'animalId' | 'lotId' | 'parentId'>;
export type TreatmentInput = Omit<EntityData['treatment'], 'animalId' | 'lotId' | 'parentId'>;
export type SymptomInput = Omit<EntityData['symptomRecord'], 'animalId' | 'lotId'>;
export type HealthEventInput = Omit<EntityData['healthEvent'], 'animalId' | 'lotId'>;

/**
 * Registra a vacinacao. Para um lote, grava o registro do lote e, na mesma
 * operacao, uma copia para cada animal vinculado a ele, de modo que o
 * historico acompanhe o animal mesmo que ele mude de lote depois.
 */
export function registerVaccination(
  store: LocalStore,
  target: HealthTarget,
  input: VaccinationInput,
): Promise<{ record: VaccinationRecord; copies: number }> {
  return store.transact((tx) => {
    const record = tx.create('vaccination', { ...input, ...targetFields(target), parentId: null });
    if (target.type === 'animal') return { record, copies: 0 };

    const animals = identifiedInLot(target.id, store.all('animal'));
    for (const animal of animals) {
      tx.create('vaccination', { ...input, animalId: animal.id, lotId: null, parentId: record.id });
    }
    return { record, copies: animals.length };
  });
}

export function registerTreatment(
  store: LocalStore,
  target: HealthTarget,
  input: TreatmentInput,
): Promise<{ record: TreatmentRecord; copies: number }> {
  return store.transact((tx) => {
    const record = tx.create('treatment', { ...input, ...targetFields(target), parentId: null });
    if (target.type === 'animal') return { record, copies: 0 };

    const animals = identifiedInLot(target.id, store.all('animal'));
    for (const animal of animals) {
      tx.create('treatment', { ...input, animalId: animal.id, lotId: null, parentId: record.id });
    }
    return { record, copies: animals.length };
  });
}

export function registerSymptom(store: LocalStore, target: HealthTarget, input: SymptomInput) {
  return store.create('symptomRecord', { ...input, ...targetFields(target) });
}

export function registerHealthEvent(store: LocalStore, target: HealthTarget, input: HealthEventInput) {
  return store.create('healthEvent', { ...input, ...targetFields(target) });
}

/** Exclui um registro sanitario; se for de lote, exclui tambem as copias individuais. */
export function removeHealthRecord(
  store: LocalStore,
  entity: 'vaccination' | 'treatment' | 'symptomRecord' | 'healthEvent',
  id: string,
): Promise<void> {
  return store.transact((tx) => {
    if (entity === 'vaccination' || entity === 'treatment') {
      for (const copy of store.all(entity)) {
        if (copy.parentId === id) tx.remove(entity, copy.id);
      }
    }
    tx.remove(entity, id);
  });
}

/** Exclui o lote. Os animais vinculados continuam cadastrados, sem lote. */
export function removeLot(store: LocalStore, lotId: string): Promise<void> {
  return store.transact((tx) => {
    for (const animal of store.all('animal')) {
      if (animal.lotId === lotId) tx.update('animal', animal.id, { lotId: null });
    }
    tx.remove('lot', lotId);
  });
}

export function removeAnimal(store: LocalStore, animalId: string): Promise<void> {
  return store.remove('animal', animalId);
}
