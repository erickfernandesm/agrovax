import { z } from 'zod';

/** Siglas das unidades federativas do Brasil. */
export const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export type BrState = (typeof BR_STATES)[number];

export const createFarmSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da fazenda.').max(120),
  city: z.string().trim().min(1).max(120).nullable().optional(),
  state: z.enum(BR_STATES).nullable().optional(),
});
export type CreateFarmInput = z.infer<typeof createFarmSchema>;

export const updateFarmSchema = createFarmSchema.partial();
export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;
