import {
  CATEGORY_LABEL,
  PURPOSE_LABEL,
  SEX_LABEL,
  SPECIES_LABEL,
  type AnimalRecord,
  type LotRecord,
  type Species,
} from '@agrovax/shared';
import type { IconName } from '../../components/ListRow';

/** Textos e icones usados nas listas e fichas de animais e lotes. */

export const SPECIES_ICON: Record<Species, IconName> = {
  BOVINE: 'cow',
  EQUINE: 'horse-variant',
};

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

export function describeAnimal(animal: AnimalRecord): string {
  return join([
    SPECIES_LABEL[animal.species],
    SEX_LABEL[animal.sex],
    animal.category ? CATEGORY_LABEL[animal.category] : null,
    animal.breed,
  ]);
}

export function describeLot(lot: LotRecord): string {
  return join([
    SPECIES_LABEL[lot.species],
    lot.category ? CATEGORY_LABEL[lot.category] : null,
    lot.purpose ? PURPOSE_LABEL[lot.purpose] : null,
    lot.location,
  ]);
}

export function heads(count: number): string {
  return count === 1 ? '1 cabeça' : `${count.toLocaleString('pt-BR')} cabeças`;
}

export function animalTitle(animal: AnimalRecord): string {
  return animal.name ? `${animal.tag} · ${animal.name}` : animal.tag;
}
