import { z } from 'zod';

export const DOSAGE_FORMS = ['TABLET', 'SYRUP', 'CAPSULE', 'INJECTION', 'CREAM', 'OTHER'] as const;

/** Form inputs send '' for "not filled in": store that as NULL. */
const optionalText = (max: number) =>
    z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), z.string().trim().max(max).nullable());

/** Master data for a medicine (stock and expiry live in batches, never here). */
export const medicineSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(255),
    unit: z.string().trim().min(1, 'Unit is required').max(50),
    price_per_unit: z.coerce.number({ message: 'Price must be a number' }).min(0, 'Price cannot be negative').max(1_000_000),
    generic_name: optionalText(255).optional(),
    manufacturer: optionalText(255).optional(),
    category: optionalText(100).optional(),
    location: optionalText(100).optional(),
    strength: optionalText(50).optional(),
    dosage_form: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.enum(DOSAGE_FORMS).nullable()).optional(),
    min_stock_level: z.preprocess((v) => (v === '' || v === undefined || v === null ? 10 : v), z.coerce.number().int().min(0).max(1_000_000)),
});

export type MedicineInput = z.infer<typeof medicineSchema>;

export const positiveId = z.coerce.number().int().positive();
