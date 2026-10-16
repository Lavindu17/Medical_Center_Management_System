import type { Level, ResourceKey } from './registry';
import type { GrantMap } from './defaults';

/** Combinations worth a second look (not blocked: a small clinic may need one person to do both). */
export const CONFLICTS: { a: [ResourceKey, Level]; b: [ResourceKey, Level]; message: string }[] = [
    { a: ['pharmacy.dispensing', 'approve'], b: ['pharmacy.inventory', 'change'], message: 'Can dispense medicines and also edit stock, so a missing medicine could be hidden by changing the stock.' },
    { a: ['consultations', 'approve'], b: ['pharmacy.dispensing', 'approve'], message: 'Can complete consultations and dispense the prescription they wrote.' },
    { a: ['hr.attendance', 'change'], b: ['hr.attendance', 'approve'], message: 'Can edit attendance records and also approve corrections to them.' },
    { a: ['billing', 'approve'], b: ['admin.revenue', 'view'], message: 'Can record payments and also see the revenue figures that include them.' },
];

export function conflictsIn(grants: GrantMap): string[] {
    return CONFLICTS.filter((c) => grants[c.a[0]]?.[c.a[1]] && grants[c.b[0]]?.[c.b[1]]).map((c) => c.message);
}
