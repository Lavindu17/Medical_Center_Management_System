import { describe, it, expect } from 'vitest';
import { daysFromToday, firstName, friendlyDay, greeting, parseDay, shortTime } from '@/lib/dates';

// A fixed "now": Tuesday 14 October 2026, 15:30 local time
const NOW = new Date(2026, 9, 14, 15, 30);

describe('parseDay', () => {
    it('reads a date as a local calendar day, never shifted by the time zone', () => {
        const d = parseDay('2030-01-07');
        expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2030, 0, 7]);
    });

    it('ignores a time part', () => {
        expect(parseDay('2030-01-07T23:59:59Z').getDate()).toBe(7);
    });
});

describe('daysFromToday / friendlyDay', () => {
    it.each([
        ['2026-10-14', 0, 'Today'],
        ['2026-10-15', 1, 'Tomorrow'],
        ['2026-10-13', -1, 'Yesterday'],
    ])('%s -> %i days -> %s', (day, diff, label) => {
        expect(daysFromToday(day, NOW)).toBe(diff);
        expect(friendlyDay(day, NOW)).toBe(label);
    });

    it('formats other days with weekday and month, adding the year only when it is not this year', () => {
        expect(friendlyDay('2026-10-21', NOW)).toBe('Wed 21 Oct');
        expect(friendlyDay('2027-02-05', NOW)).toBe('Fri 5 Feb 2027');
    });

    it('counts across month and year boundaries', () => {
        expect(daysFromToday('2026-12-31', new Date(2026, 11, 30))).toBe(1);
        expect(daysFromToday('2027-01-01', new Date(2026, 11, 31, 23, 59))).toBe(1);
    });

    it('is not thrown off by the time of day', () => {
        expect(friendlyDay('2026-10-14', new Date(2026, 9, 14, 0, 0, 1))).toBe('Today');
        expect(friendlyDay('2026-10-14', new Date(2026, 9, 14, 23, 59, 59))).toBe('Today');
    });
});

describe('shortTime', () => {
    it.each([['10:00:00', '10:00'], ['09:15', '09:15'], ['', '']])('%j -> %j', (input, expected) => {
        expect(shortTime(input)).toBe(expected);
    });
});

describe('greeting', () => {
    it.each([[2, 'Hello'], [8, 'Good morning'], [11, 'Good morning'], [12, 'Good afternoon'], [17, 'Good afternoon'], [18, 'Good evening'], [23, 'Good evening']])(
        'at %i:00 -> %s', (hour, expected) => {
            expect(greeting(new Date(2026, 9, 14, hour))).toBe(expected);
        });
});

describe('firstName', () => {
    it.each([['Amal Rathnayake', 'Amal'], ['Dr. Jane Doe', 'Jane'], ['  prof amal Perera', 'amal'], ['Madonna', 'Madonna'], ['', ''], [null, '']])(
        '%j -> %j', (input, expected) => {
            expect(firstName(input)).toBe(expected);
        });
});
