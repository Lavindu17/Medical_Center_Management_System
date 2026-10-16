import { RESOURCE_KEYS } from './registry';
import { ROLE_TEMPLATES, STAFF_ROLES, normalise, type StaffRole } from './defaults';

/** The ticks a role starts with, one row per screen (so "nothing" is stored as nothing). */
export function templateRows(role: StaffRole) {
    return RESOURCE_KEYS.map((key) => {
        const g = normalise(key, ROLE_TEMPLATES[role][key] ?? {});
        return { resource: key, view: +Boolean(g.view), add: +Boolean(g.add), change: +Boolean(g.change), approve: +Boolean(g.approve) };
    });
}

/**
 * The text of 23_access_seed.sql: writes each role's starting profile into the database. It only adds what is missing
 * (INSERT IGNORE), so running it again never undoes changes made in the access window. A test keeps the committed file equal
 * to this output.
 */
export function buildSeedSql(): string {
    const lines: string[] = [
        '-- ============================================================',
        '-- 23_access_seed.sql : each role\'s starting permissions, written into the database',
        '--',
        '-- Access is decided only by what is stored in access_profiles / access_grants (see 22_access_control.sql): with nothing',
        '-- stored, no member of staff can open anything. This file stores the starting point for every role, which is what each',
        '-- role could always do. Edit them afterwards in the Access control window (Profiles and roles).',
        '--',
        '-- Safe to run more than once: it only adds rows that are missing and never changes ones you edited.',
        '-- GENERATED from src/lib/access/defaults.ts by a test; change the defaults there, not here.',
        '-- ============================================================',
        '',
    ];
    for (const role of STAFF_ROLES) {
        lines.push(`INSERT IGNORE INTO \`access_profiles\` (\`name\`, \`system_role\`) VALUES ('Role: ${role}', '${role}');`);
        lines.push('INSERT IGNORE INTO `access_grants` (`profile_id`, `resource`, `can_view`, `can_add`, `can_change`, `can_approve`)');
        lines.push('SELECT p.`id`, v.`resource`, v.`can_view`, v.`can_add`, v.`can_change`, v.`can_approve` FROM `access_profiles` p JOIN (');
        lines.push(templateRows(role).map((r, i) =>
            `  ${i === 0 ? '      ' : 'UNION ALL '}SELECT '${r.resource}' AS \`resource\`, ${r.view} AS \`can_view\`, ${r.add} AS \`can_add\`, ${r.change} AS \`can_change\`, ${r.approve} AS \`can_approve\``).join('\n'));
        lines.push(`) v WHERE p.\`system_role\` = '${role}';`);
        lines.push('');
    }
    return lines.join('\n');
}
