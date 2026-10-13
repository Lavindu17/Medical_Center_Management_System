import { describe, it, expect } from 'vitest';
import { daysAround, dayLabel, fillDays, monthComparison, pctChange, recentDays } from '@/lib/dashboard-range';

describe('dashboard ranges', () => {
    it('recentDays ends on today and has n days, across month and year ends', () => {
        expect(recentDays('2026-03-02', 4)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
        expect(recentDays('2026-01-01', 2)).toEqual(['2025-12-31', '2026-01-01']);
        expect(recentDays('2026-10-13', 1)).toEqual(['2026-10-13']);
    });
    it('daysAround spans back and ahead', () => {
        const d = daysAround('2026-10-13', 2, 3);
        expect(d[0]).toBe('2026-10-11');
        expect(d[d.length - 1]).toBe('2026-10-16');
        expect(d).toHaveLength(6);
    });
    it('monthComparison: this month so far vs the whole of last month, including January', () => {
        expect(monthComparison('2026-10-13')).toEqual({ thisFrom: '2026-10-01', thisTo: '2026-10-13', lastFrom: '2026-09-01', lastTo: '2026-09-30' });
        expect(monthComparison('2026-01-05')).toEqual({ thisFrom: '2026-01-01', thisTo: '2026-01-05', lastFrom: '2025-12-01', lastTo: '2025-12-31' });
        expect(monthComparison('2024-03-10').lastTo).toBe('2024-02-29');
    });
    it('pctChange', () => {
        expect(pctChange(150, 100)).toBe(50);
        expect(pctChange(50, 100)).toBe(-50);
        expect(pctChange(10, 0)).toBeNull();
        expect(pctChange(NaN, 5)).toBeNull();
    });
    it('fillDays puts zeros on days with no rows', () => {
        expect(fillDays<{ n: number }>(['a', 'b', 'c'], [{ day: 'b', n: 4 }], ['n'])).toEqual([{ day: 'a', n: 0 }, { day: 'b', n: 4 }, { day: 'c', n: 0 }]);
    });
    it('dayLabel', () => { expect(dayLabel('2026-10-13')).toBe('Tue 13'); });
});
