import { LEVELS, RESOURCE_KEYS, levelsOf, type Level, type ResourceKey } from './registry';

export type Grant = Partial<Record<Level, boolean>>;
export type GrantMap = Partial<Record<ResourceKey, Grant>>;

/** Roles whose default profile exists. PATIENT is the customer side and gets nothing here. */
export const STAFF_ROLES = ['DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'HR_MANAGER', 'ADMIN', 'STAFF'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const on = (...levels: Level[]): Grant => Object.fromEntries(levels.map((l) => [l, true]));
/** Every member of staff starts with their own work and account pages */
const ME: GrantMap = { 'my.work': { view: true, add: true }, 'my.account': { view: true, change: true } };
const all = (key: ResourceKey): Grant => on(...levelsOf(key));

/**
 * The starting point for each role: the ticks a site begins with. They are written into the database (23_access_seed.sql, or
 * "Reset to defaults" in the access window) and the database is the only thing that decides access: with nothing stored,
 * nobody can open anything. They equal the rules that were fixed in code before access became configurable.
 */
export const ROLE_TEMPLATES: Record<StaffRole, GrantMap> = {
    // "Other staff": no duties of its own, only their own work and account pages. Everything else comes from profiles.
    STAFF: {},
    RECEPTIONIST: {
        'reception.dashboard': on('view'),
        'reception.appointments': on('view', 'add', 'change'),
        'reception.patients': on('view', 'add', 'change'),
        billing: on('view', 'approve'),
    },
    DOCTOR: {
        'doctor.dashboard': on('view'),
        consultations: on('view', 'add', 'change', 'approve'),
        'doctor.patients': on('view'),
        'doctor.earnings': on('view'),
        'doctor.profile': on('view', 'change'),
        // Doctors could always read and add lab tests (the catalogue they order from)
        'lab.tests': on('view', 'add'),
    },
    PHARMACIST: {
        'pharmacy.dashboard': on('view'),
        'pharmacy.dispensing': on('view', 'approve'),
        'pharmacy.inventory': on('view', 'add', 'change'),
        'pharmacy.alerts': on('view'),
    },
    LAB_ASSISTANT: {
        'lab.dashboard': on('view'),
        'lab.requests': on('view', 'add'),
        'lab.tests': on('view', 'add'),
    },
    HR_MANAGER: Object.fromEntries(RESOURCE_KEYS.filter((k) => k.startsWith('hr.')).map((k) => [k, all(k)])) as GrantMap,
    // Administrators run the clinic: all of administration and HR, plus what they could always do at the front desk. Clinical
    // work (consulting, dispensing) is not theirs by default; it can be added to an administrator like to anyone else.
    ADMIN: {
        ...(Object.fromEntries(RESOURCE_KEYS.filter((k) => k.startsWith('admin.') || k.startsWith('hr.') || k === 'access.config').map((k) => [k, all(k)])) as GrantMap),
        'reception.appointments': on('view', 'add', 'change'),
        'reception.patients': on('view', 'add', 'change'),
        'pharmacy.inventory': on('view'),
        'lab.tests': on('view', 'add'),
        'lab.requests': on('view'),
    },
};

// Everyone in staff has their own work and account pages
for (const role of STAFF_ROLES) ROLE_TEMPLATES[role] = { ...ROLE_TEMPLATES[role], ...ME };

/** Whoever holds this can always change access, so a site can never lock itself out of the configuration window. */
export const ALWAYS_ADMIN: ResourceKey = 'access.config';

export const isStaffRole = (role: string): role is StaffRole => (STAFF_ROLES as readonly string[]).includes(role);

/** A grant with the rules applied: anything above "view" implies "view", and only levels the resource offers count. */
export function normalise(key: ResourceKey, grant: Grant): Grant {
    const offered = new Set(levelsOf(key));
    const out: Grant = {};
    for (const l of LEVELS) if (grant[l] && offered.has(l)) out[l] = true;
    if ((out.add || out.change || out.approve) && offered.has('view')) out.view = true;
    return out;
}

/** Combines two grant maps: a level is allowed when either allows it. */
export function mergeGrants(a: GrantMap, b: GrantMap): GrantMap {
    const out: GrantMap = {};
    for (const key of RESOURCE_KEYS) {
        const x = a[key], y = b[key];
        if (!x && !y) continue;
        out[key] = normalise(key, { ...Object.fromEntries(LEVELS.filter((l) => x?.[l] || y?.[l]).map((l) => [l, true])) });
    }
    return out;
}
