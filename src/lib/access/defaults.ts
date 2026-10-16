import { LEVELS, RESOURCE_KEYS, levelsOf, type Level, type ResourceKey } from './registry';

export type Grant = Partial<Record<Level, boolean>>;
export type GrantMap = Partial<Record<ResourceKey, Grant>>;

/** Roles whose default profile exists. PATIENT is the customer side and gets nothing here. */
export const STAFF_ROLES = ['DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'HR_MANAGER', 'ADMIN'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const on = (...levels: Level[]): Grant => Object.fromEntries(levels.map((l) => [l, true]));
const all = (key: ResourceKey): Grant => on(...levelsOf(key));

/**
 * What each role could do before access control became configurable. A site starts from these; the configuration window
 * edits copies stored in the database. Keeping them exactly equal to the old fixed rules is what lets the switch to
 * configurable permissions change nothing until someone configures something.
 */
export const ROLE_DEFAULTS: Record<StaffRole, GrantMap> = {
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
