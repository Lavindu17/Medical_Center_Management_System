import type { FoodTiming } from '@/lib/prescription-calc';

export type { FoodTiming };

export interface Medicine {
    id: number;
    name: string;
    generic_name?: string | null;
    strength?: string | null;
    stock: number;
    usable_stock?: number | string;
    unit: string;
    dosage_form?: string | null;
    price?: number | string;
}

/** A prescription line before it is added: the medicine and how it is taken. */
export interface LineDraft {
    med: Medicine;
    dose: string;
    times: [string, string, string, string];
    duration: string;
    asNeeded: boolean;
    foodTiming: FoodTiming | null;
    instructions: string;
}

/** A saved line for a medicine (a favourite or a recently used one), as the presets endpoint returns it. */
export interface PresetLine {
    medicineId: number;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string | null;
    foodTiming?: FoodTiming | null;
    asNeeded?: boolean;
}

export interface LabPanel { id: number; name: string; testIds: number[] }

/** A draft from a saved line. The dose is the first used slot's amount, so the form shows what the line really says. */
export function draftFromPreset(med: Medicine, p: PresetLine): LineDraft {
    const times = p.frequency.split('-') as [string, string, string, string];
    const dose = times.find((t) => t && t !== '0') ?? p.dosage;
    return { med, dose, times, duration: p.duration, asNeeded: Boolean(p.asNeeded), foodTiming: p.foodTiming ?? null, instructions: p.instructions ?? '' };
}
