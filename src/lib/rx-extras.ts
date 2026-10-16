import { FOOD_TEXT, type FoodTiming } from '@/lib/prescription-calc';

/**
 * The extra directions on a prescription line, as short phrases ("Take after food", "Only when needed", the doctor's note).
 * Accepts the line as any API returns it (snake_case from the database or camelCase from the consultation screen).
 */
export function rxExtraNotes(item: { food_timing?: string | null; foodTiming?: string | null; as_needed?: number | boolean | null; asNeeded?: number | boolean | null; instructions?: string | null }): string[] {
    const out: string[] = [];
    const food = (item.food_timing ?? item.foodTiming) as FoodTiming | null | undefined;
    if (food && FOOD_TEXT[food]) out.push(`Take ${FOOD_TEXT[food]}`);
    if (Number(item.as_needed ?? item.asNeeded ?? 0) > 0) out.push('Only when needed');
    const note = item.instructions?.trim();
    if (note) out.push(note.replace(/\.$/, ''));
    return out;
}
