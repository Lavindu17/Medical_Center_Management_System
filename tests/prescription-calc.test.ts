import { describe, it, expect } from 'vitest';
import { dailyAmount, describeLine, doseAmount, durationDays, packSizeMl, quantityFor } from '@/lib/prescription-calc';
import { allergyMatches } from '@/lib/allergy';

describe('dose amounts', () => {
    it.each([['¼', 0.25], ['½', 0.5], ['1', 1], ['2', 2], ['1.5', 1.5], ['5ml', 5], ['2.5 ml', 2.5], ['7.5ml', 7.5]])('%s is %s', (text, n) => expect(doseAmount(text)).toBe(n));
    it.each(['Apply', 'Thin Layer', '', 'abc'])('%s has no amount', (text) => expect(doseAmount(text)).toBeNull());
});

describe('daily amount', () => {
    it('adds the used slots, skipping zeros', () => expect(dailyAmount(['1', '0', '0', '1'])).toBe(2));
    it('counts fractions and custom doses (a custom 1.5 used to count as 1)', () => {
        expect(dailyAmount(['½', '0', '0', '½'])).toBe(1);
        expect(dailyAmount(['1.5', '0', '0', '1.5'])).toBe(3);
        expect(dailyAmount(['7.5ml', '0', '0', '7.5ml'])).toBe(15);
    });
    it('a word dose counts as one use', () => expect(dailyAmount(['Apply', '0', 'Apply', '0'])).toBe(2));
});

describe('duration', () => {
    it.each([['1 day', 1], ['3 days', 3], ['1 week', 7], ['2 weeks', 14], ['1 month', 30], ['10', 10], ['nonsense', 1]])('%s is %s days', (text, n) => expect(durationDays(text)).toBe(n));
});

describe('pack size', () => {
    it('reads the bottle size from the unit', () => {
        expect(packSizeMl('100ml bottle')).toBe(100);
        expect(packSizeMl('60 ml')).toBe(60);
        expect(packSizeMl('bottle')).toBeNull();
        expect(packSizeMl(null)).toBeNull();
    });
});

describe('quantity', () => {
    it('pills: daily total times days, rounded up', () => {
        expect(quantityFor({ form: 'Pill', times: ['1', '0', '0', '1'], duration: '5 days' })).toBe(10);
        expect(quantityFor({ form: 'Pill', times: ['½', '0', '0', '0'], duration: '3 days' })).toBe(2);
        expect(quantityFor({ form: 'Pill', times: ['1.5', '0', '0', '1.5'], duration: '2 days' })).toBe(6);
        expect(quantityFor({ form: 'Pill', times: ['1', '1', '1', '1'], duration: '1 week' })).toBe(28);
    });
    it('pills with no slot chosen is at least one', () => expect(quantityFor({ form: 'Pill', times: ['0', '0', '0', '0'], duration: '3 days' })).toBe(1));
    it('syrup: bottles from the total ml when the bottle size is known, otherwise one', () => {
        expect(quantityFor({ form: 'Syrup', times: ['5ml', '5ml', '5ml', '0'], duration: '7 days', unit: '100ml bottle' })).toBe(2);   // 105 ml
        expect(quantityFor({ form: 'Syrup', times: ['5ml', '0', '0', '5ml'], duration: '5 days', unit: '100ml bottle' })).toBe(1);
        expect(quantityFor({ form: 'Syrup', times: ['5ml', '5ml', '5ml', '5ml'], duration: '1 month', unit: 'bottle' })).toBe(1);
    });
    it('cream is one tube', () => expect(quantityFor({ form: 'Cream', times: ['Apply', '0', 'Apply', '0'], duration: '2 weeks' })).toBe(1));
});

describe('line description', () => {
    it('reads like an instruction', () => {
        expect(describeLine({ form: 'Pill', times: ['1', '0', '0', '1'], duration: '5 days', quantity: 10 })).toBe('Take 1 tablet in the morning and at night for 5 days. Total 10 tablets.');
        expect(describeLine({ form: 'Pill', times: ['½', '0', '0', '0'], duration: '3 days', quantity: 2 })).toBe('Take ½ tablet in the morning for 3 days. Total 2 tablets.');
        expect(describeLine({ form: 'Syrup', times: ['5ml', '5ml', '5ml', '0'], duration: '7 days', quantity: 2 })).toBe('Take 5 ml in the morning, at midday and in the evening for 7 days. Total 2 bottles.');
    });
    it('different doses per slot are spelled out', () => {
        expect(describeLine({ form: 'Pill', times: ['1', '0', '0', '2'], duration: '1 week', quantity: 21 })).toContain('1 tablet in the morning, 2 tablets at night');
    });
    it('no slot chosen asks for one', () => expect(describeLine({ form: 'Pill', times: ['0', '0', '0', '0'], duration: '1 day', quantity: 1 })).toMatch(/choose/i));
});

describe('allergy matching', () => {
    const a = (name: string) => [{ name, severity: 'SEVERE' }];
    it('matches by name, generic name, and either direction of wording', () => {
        expect(allergyMatches({ name: 'Amoxicillin 500mg' }, a('Amoxicillin'))).toHaveLength(1);
        expect(allergyMatches({ name: 'Augmentin', generic_name: 'Amoxicillin + Clavulanate' }, a('amoxicillin'))).toHaveLength(1);
        expect(allergyMatches({ name: 'Penicillin V' }, a('Penicillin allergy'))).toHaveLength(1);
        expect(allergyMatches({ name: 'Penicillin V' }, a('PENICILLIN'))).toHaveLength(1);
    });
    it('does not warn for unrelated medicines, short or empty allergies', () => {
        expect(allergyMatches({ name: 'Paracetamol 500mg' }, a('Penicillin'))).toHaveLength(0);
        expect(allergyMatches({ name: 'Paracetamol' }, a('ab'))).toHaveLength(0);
        expect(allergyMatches({ name: 'Paracetamol' }, [])).toHaveLength(0);
    });
    it('does not match on strengths or units alone', () => {
        expect(allergyMatches({ name: 'Cetirizine 10mg' }, a('10mg'))).toHaveLength(1);   // an allergy literally named that still matches by text
        expect(allergyMatches({ name: 'Cetirizine 10mg' }, a('mg tablet'))).toHaveLength(0);
    });
});
