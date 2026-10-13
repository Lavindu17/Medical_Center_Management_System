import type { MedicineForm } from '@/lib/medicine-form';

/** The four times of day a prescription line can use, in the order they are stored ("1-0-0-1"). */
export const SLOTS = ['Morning', 'Noon', 'Evening', 'Night'] as const;
export const NONE = '0';

const FRACTIONS: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75 };

/** A dose written the way the doctor picks it: "½", "1", "1.5", "5ml", "2.5 ml". Not a number for words such as "Apply". */
export function doseAmount(dose: string): number | null {
    const text = dose.trim().toLowerCase();
    if (text in FRACTIONS) return FRACTIONS[text];
    const m = /^(\d+(?:\.\d+)?)\s*(ml|mg|g|tab|tabs|tablet|tablets|cap|caps|capsule|capsules|drop|drops|puff|puffs|unit|units)?$/.exec(text);
    return m ? Number(m[1]) : null;
}

/** How much one day's slots add up to (in tablets, or in ml for syrups). Words such as "Apply" count as one use. */
export function dailyAmount(times: readonly string[]): number {
    let total = 0;
    for (const t of times) {
        if (!t || t === NONE) continue;
        total += doseAmount(t) ?? 1;
    }
    return total;
}

/** "3 days" -> 3, "1 week" -> 7, "2 weeks" -> 14, "1 month" -> 30. Anything unreadable counts as one day. */
export function durationDays(text: string): number {
    const m = /^\s*(\d+)\s*(day|days|week|weeks|month|months)?\s*$/i.exec(text);
    if (!m) return 1;
    const n = Number(m[1]);
    const unit = (m[2] ?? 'day').toLowerCase();
    if (unit.startsWith('week')) return n * 7;
    if (unit.startsWith('month')) return n * 30;
    return Math.max(1, n);
}

/** Size of one bottle in ml from a unit such as "100ml bottle" or "60 ml", or null when it does not say. */
export function packSizeMl(unit: string | null | undefined): number | null {
    const m = /(\d+(?:\.\d+)?)\s*ml\b/i.exec(unit ?? '');
    return m ? Number(m[1]) : null;
}

export interface QuantityInput {
    form: MedicineForm;
    times: readonly string[];
    duration: string;
    /** The medicine's unit text (used to find the bottle size for syrups) */
    unit?: string | null;
}

/**
 * How many units of the medicine to dispense: tablets for pills, bottles for syrups (when the bottle size is
 * known), one tube for creams. Never less than one.
 */
export function quantityFor({ form, times, duration, unit }: QuantityInput): number {
    const days = durationDays(duration);
    const daily = dailyAmount(times);
    if (form === 'Pill') return Math.max(1, Math.ceil(daily * days));
    if (form === 'Syrup') {
        const pack = packSizeMl(unit);
        return pack ? Math.max(1, Math.ceil((daily * days) / pack)) : 1;
    }
    return 1;
}

/** Whether any slot is used. */
export const hasSlots = (times: readonly string[]) => times.some((t) => t && t !== NONE);

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
const trim = (n: number) => (n === 0.25 ? '¼' : n === 0.5 ? '½' : n === 0.75 ? '¾' : Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

/** "morning and night", "morning, noon and night" */
function joinSlots(names: string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The line as the patient and the pharmacist will read it, for example
 * "Take 1 tablet in the morning and at night for 5 days. Total 10 tablets."
 */
export function describeLine(input: { form: MedicineForm; times: readonly string[]; duration: string; quantity: number }): string {
    const { form, times, duration, quantity } = input;
    const used = times.map((t, i) => ({ t, name: ['in the morning', 'at midday', 'in the evening', 'at night'][i] })).filter((x) => x.t && x.t !== NONE);
    if (used.length === 0) return 'Choose when to take it.';
    const when = joinSlots(used.map((x) => x.name));
    const same = used.every((x) => x.t === used[0].t);
    const amount = (t: string) => {
        const n = doseAmount(t);
        if (form === 'Cream') return 'a thin layer';
        if (n === null) return t;
        return form === 'Syrup' ? `${trim(n)} ml` : `${trim(n)} ${n <= 1 ? 'tablet' : 'tablets'}`;
    };
    const dose = same ? amount(used[0].t) : used.map((x) => `${amount(x.t)} ${x.name}`).join(', ');
    const take = form === 'Cream' ? 'Apply' : 'Take';
    const body = same ? `${take} ${dose} ${when}` : `${take} ${dose}`;
    const total = form === 'Pill' ? ` Total ${quantity} ${plural(quantity, 'tablet')}.` : form === 'Syrup' ? ` Total ${quantity} ${plural(quantity, 'bottle')}.` : ` Total ${quantity} ${plural(quantity, 'tube')}.`;
    return `${body} for ${duration}.${total}`;
}
