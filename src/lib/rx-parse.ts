import { NONE, doseAmount, type FoodTiming } from '@/lib/prescription-calc';

export interface CatalogueMedicine { id: number; name: string; generic_name?: string | null; strength?: string | null }

export interface ParsedRx {
    /** Medicines that fit the words left over, best first (at most five) */
    matches: CatalogueMedicine[];
    /** The dose the doctor typed ("½", "5ml"), or null to use the medicine's usual one */
    dose: string | null;
    /** Four slots (morning, noon, evening, night) using `dose`, or null when no frequency was typed */
    times: ((dose: string) => [string, string, string, string]) | null;
    /** "5 days", "2 weeks", "1 month", or null */
    duration: string | null;
    asNeeded: boolean;
    foodTiming: FoodTiming | null;
    /** The words that were taken as the medicine's name */
    words: string[];
}

const FREQUENCY: Record<string, (d: string) => [string, string, string, string]> = {
    od: (d) => [d, NONE, NONE, NONE], qd: (d) => [d, NONE, NONE, NONE], daily: (d) => [d, NONE, NONE, NONE], mane: (d) => [d, NONE, NONE, NONE],
    nocte: (d) => [NONE, NONE, NONE, d], nt: (d) => [NONE, NONE, NONE, d], hs: (d) => [NONE, NONE, NONE, d],
    bd: (d) => [d, NONE, NONE, d], bid: (d) => [d, NONE, NONE, d],
    tds: (d) => [d, d, NONE, d], tid: (d) => [d, d, NONE, d],
    qds: (d) => [d, d, d, d], qid: (d) => [d, d, d, d],
};
const AS_NEEDED = new Set(['prn', 'sos']);
const FOOD_WORDS: Record<string, FoodTiming> = { ac: 'BEFORE', pc: 'AFTER', cc: 'WITH' };

const FRACTIONS: Record<string, string> = { '1/2': '½', '1/4': '¼', '3/4': '¾', '½': '½', '¼': '¼', '¾': '¾' };

/** "1-0-0-1" or "½-0-0-½": four slots written out. */
function slotPattern(word: string): ((dose: string) => [string, string, string, string]) | null {
    const parts = word.split(/[-–]/);
    if (parts.length !== 4) return null;
    const ok = parts.map((p) => (p === '0' ? NONE : FRACTIONS[p] ?? (/^\d+(\.\d+)?(ml)?$/.test(p) ? p : null)));
    if (ok.some((p) => p === null) || ok.every((p) => p === NONE)) return null;
    return () => ok as [string, string, string, string];
}

/** "5d" -> "5 days", "2w" -> "2 weeks", "1m" -> "1 month", "x5" -> "5 days" */
function durationWord(word: string): string | null {
    const m = /^x?(\d{1,3})\s*(d|day|days|w|wk|wks|week|weeks|m|mo|month|months)?$/.exec(word);
    if (!m || (!m[2] && !word.startsWith('x'))) return null;
    const n = Number(m[1]);
    if (n < 1) return null;
    const unit = m[2] ?? 'd';
    if (unit.startsWith('w')) return `${n} ${n === 1 ? 'week' : 'weeks'}`;
    if (unit.startsWith('m')) return `${n} ${n === 1 ? 'month' : 'months'}`;
    return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/** A dose: a fraction, a small number (up to 3), or an amount in ml. Bigger bare numbers are strengths ("500"). */
function doseWord(word: string): string | null {
    if (FRACTIONS[word]) return FRACTIONS[word];
    if (/^\d+(\.\d+)?ml$/.test(word)) return word;
    if (/^\d+(\.\d+)?$/.test(word) && Number(word) > 0 && Number(word) <= 3) return word;
    return null;
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase();

/**
 * Reads a line such as "amox 500 tds 5d" or "paracetamol 1 qds prn after food 3 days" into a dose, slots, duration,
 * food timing and the words that name the medicine, and finds the medicines in the catalogue that fit those words.
 */
export function parseRxLine(text: string, catalogue: CatalogueMedicine[]): ParsedRx {
    let rest = ` ${norm(text).replace(/[,;]+/g, ' ')} `;
    let foodTiming: FoodTiming | null = null;
    for (const [phrase, timing] of [['before food', 'BEFORE'], ['after food', 'AFTER'], ['with food', 'WITH'], ['before meals', 'BEFORE'], ['after meals', 'AFTER']] as const) {
        if (rest.includes(` ${phrase} `)) { foodTiming = timing; rest = rest.replace(` ${phrase} `, ' '); }
    }

    // "3 days" typed with a space is one word
    rest = rest.replace(/ (\d{1,3}) (days?|weeks?|months?|wks?) /g, ' $1$2 ');

    let dose: string | null = null, times: ParsedRx['times'] = null, duration: string | null = null, asNeeded = false;
    const words: string[] = [];
    for (const word of rest.split(/\s+/).filter(Boolean)) {
        if (FREQUENCY[word] && !times) { times = FREQUENCY[word]; continue; }
        const pattern = slotPattern(word);
        if (pattern && !times) { times = pattern; continue; }
        if (AS_NEEDED.has(word)) { asNeeded = true; continue; }
        if (FOOD_WORDS[word]) { foodTiming = FOOD_WORDS[word]; continue; }
        const d = durationWord(word);
        if (d && !duration) { duration = d; continue; }
        const dz = doseWord(word);
        if (dz && !dose) { dose = dz; continue; }
        words.push(word);
    }

    // Medicines whose name, generic name or strength contain every remaining word; names that start with the first word come first
    const matches = words.length === 0 ? [] : catalogue
        .map((m) => ({ m, hay: `${norm(m.name)} ${norm(m.generic_name)} ${norm(m.strength)}` }))
        .filter(({ hay }) => words.every((w) => hay.includes(w)))
        .sort((a, b) => {
            const rank = (x: { m: CatalogueMedicine; hay: string }) => (norm(x.m.name).startsWith(words[0]) ? 0 : x.hay.startsWith(words[0]) ? 1 : 2);
            return rank(a) - rank(b) || a.m.name.length - b.m.name.length || a.m.name.localeCompare(b.m.name);
        })
        .slice(0, 5)
        .map(({ m }) => m);

    // A typed dose in words that doseAmount does not know would break the quantity maths, so drop it
    if (dose && doseAmount(dose) === null) dose = null;
    return { matches, dose, times, duration, asNeeded, foodTiming, words };
}
