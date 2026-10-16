import { describe, it, expect } from 'vitest';
import { parseRxLine } from '@/lib/rx-parse';
import { describeLine } from '@/lib/prescription-calc';

const catalogue = [
    { id: 1, name: 'Paracetamol 500mg', generic_name: 'Paracetamol', strength: '500mg' },
    { id: 2, name: 'Amoxicillin 250mg', generic_name: 'Amoxicillin', strength: '250mg' },
    { id: 3, name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', strength: '500mg' },
    { id: 4, name: 'Amlodipine 5mg', generic_name: 'Amlodipine', strength: '5mg' },
    { id: 5, name: 'Salbutamol Syrup', generic_name: 'Salbutamol', strength: null },
];

describe('smart entry line', () => {
    it('reads medicine, strength, frequency and duration', () => {
        const p = parseRxLine('amox 500 tds 5d', catalogue);
        expect(p.matches[0].id).toBe(3);                        // "500" is a strength, not a dose
        expect(p.words).toEqual(['amox', '500']);
        expect(p.dose).toBeNull();
        expect(p.times!('1')).toEqual(['1', '1', '0', '1']);
        expect(p.duration).toBe('5 days');
    });

    it.each([
        ['para od', ['1', '0', '0', '0']],
        ['para bd', ['1', '0', '0', '1']],
        ['para BID', ['1', '0', '0', '1']],
        ['para qds', ['1', '1', '1', '1']],
        ['para nocte', ['0', '0', '0', '1']],
        ['para mane', ['1', '0', '0', '0']],
    ])('frequency in "%s"', (text, slots) => expect(parseRxLine(text, catalogue).times!('1')).toEqual(slots));

    it('uses a typed dose for every slot', () => {
        const p = parseRxLine('para ½ bd 3d', catalogue);
        expect(p.dose).toBe('½');
        expect(p.times!(p.dose!)).toEqual(['½', '0', '0', '½']);
        expect(parseRxLine('para 1/2 bd', catalogue).dose).toBe('½');
        expect(parseRxLine('salbutamol 5ml tds 1w', catalogue)).toMatchObject({ dose: '5ml', duration: '1 week' });
        expect(parseRxLine('para 1.5 bd', catalogue).dose).toBe('1.5');
    });

    it('reads a written-out slot pattern', () => {
        const p = parseRxLine('para 1-0-0-2 5d', catalogue);
        expect(p.times!('1')).toEqual(['1', '0', '0', '2']);
        expect(parseRxLine('para ½-0-0-½', catalogue).times!('1')).toEqual(['½', '0', '0', '½']);
        expect(parseRxLine('para 0-0-0-0', catalogue).times).toBeNull();
    });

    it.each([['5d', '5 days'], ['1d', '1 day'], ['2w', '2 weeks'], ['1w', '1 week'], ['3 days', '3 days'], ['1 month', '1 month'], ['2m', '2 months'], ['x7', '7 days']])('duration %s', (word, expected) =>
        expect(parseRxLine(`para bd ${word}`, catalogue).duration).toBe(expected));

    it('reads as-needed and food timing, in short and long forms', () => {
        expect(parseRxLine('para prn', catalogue).asNeeded).toBe(true);
        expect(parseRxLine('para sos', catalogue).asNeeded).toBe(true);
        expect(parseRxLine('para tds pc', catalogue).foodTiming).toBe('AFTER');
        expect(parseRxLine('para tds ac', catalogue).foodTiming).toBe('BEFORE');
        expect(parseRxLine('para tds cc', catalogue).foodTiming).toBe('WITH');
        expect(parseRxLine('para tds after food 5d', catalogue)).toMatchObject({ foodTiming: 'AFTER', duration: '5 days' });
        expect(parseRxLine('para tds with food', catalogue).words).toEqual(['para']);
    });

    it('ranks names that start with the typed word first, and returns at most five', () => {
        expect(parseRxLine('am', catalogue).matches.map((m) => m.id).slice(0, 3)).toEqual([4, 2, 3]);       // names starting with "am", then names that only contain it
        expect(parseRxLine('mg', catalogue).matches.length).toBeLessThanOrEqual(5);
    });

    it('matches on generic name and strength, and reports nothing for unknown words', () => {
        expect(parseRxLine('salbutamol', catalogue).matches.map((m) => m.id)).toEqual([5]);
        expect(parseRxLine('250', catalogue).words).toEqual(['250']);
        expect(parseRxLine('250mg', catalogue).matches.map((m) => m.id)).toEqual([2]);
        expect(parseRxLine('zzzz bd', catalogue).matches).toEqual([]);
    });

    it('empty and odd input is harmless', () => {
        for (const text of ['', '   ', 'bd', '5d', ',,,', '0', '-', '1-2-3']) expect(() => parseRxLine(text, catalogue)).not.toThrow();
        expect(parseRxLine('bd 5d', catalogue).matches).toEqual([]);
    });
});

describe('line description with the extras', () => {
    const base = { form: 'Pill' as const, times: ['1', '1', '0', '1'], duration: '5 days', quantity: 15 };
    it('adds food timing and a note', () => {
        expect(describeLine({ ...base, foodTiming: 'AFTER' })).toBe('Take 1 tablet in the morning, at midday and at night for 5 days. Take after food. Total 15 tablets.');
        expect(describeLine({ ...base, instructions: 'Finish the whole course.' })).toContain('Finish the whole course. Total');
    });
    it('as needed says so and caps the daily use', () => {
        expect(describeLine({ ...base, asNeeded: true })).toBe('Take 1 tablet when needed, up to 3 times a day for 5 days. Total 15 tablets.');
    });
    it('food timing is not added to creams', () => {
        expect(describeLine({ form: 'Cream', times: ['Apply', '0', 'Apply', '0'], duration: '1 week', quantity: 1, foodTiming: 'AFTER' })).not.toMatch(/food/);
    });
});
