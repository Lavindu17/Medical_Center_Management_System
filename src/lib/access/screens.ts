import type { Level, ResourceKey } from './registry';
import type { GrantMap } from './defaults';

/**
 * The staff app's screens: what appears in the menu and which permission opens each one. The staff app is one shell for
 * everybody; what a person sees in it is exactly what their permissions allow.
 */
export interface Screen {
    label: string;
    href: string;
    /** Name of a lucide icon (resolved in the menu component, so this file stays free of UI code) */
    icon: string;
    /** Menu heading */
    section: string;
    resource: ResourceKey;
    level: Level;
    /** Other paths that belong to this screen (a detail page, a booking page) */
    also?: string[];
}

export const SCREENS: Screen[] = [
    // Dashboards
    { section: 'Dashboards', label: 'Clinic overview', href: '/admin', icon: 'LayoutDashboard', resource: 'admin.dashboard', level: 'view' },
    { section: 'Dashboards', label: 'HR overview', href: '/hr', icon: 'LayoutDashboard', resource: 'hr.overview', level: 'view' },
    { section: 'Dashboards', label: 'Reception', href: '/receptionist', icon: 'LayoutDashboard', resource: 'reception.dashboard', level: 'view' },
    { section: 'Dashboards', label: 'Doctor', href: '/doctor', icon: 'LayoutDashboard', resource: 'doctor.dashboard', level: 'view' },
    { section: 'Dashboards', label: 'Pharmacy', href: '/pharmacist', icon: 'LayoutDashboard', resource: 'pharmacy.dashboard', level: 'view' },
    // Front desk
    { section: 'Front desk', label: 'Appointments', href: '/receptionist/appointments', icon: 'CalendarCheck', resource: 'reception.appointments', level: 'view', also: ['/receptionist/appointments/book'] },
    { section: 'Front desk', label: 'Register patient', href: '/receptionist/register', icon: 'UserPlus', resource: 'reception.patients', level: 'add' },
    { section: 'Front desk', label: 'Patient directory', href: '/receptionist/patients', icon: 'Users', resource: 'reception.patients', level: 'view' },
    // Clinical
    { section: 'Clinical', label: 'My appointments', href: '/doctor/appointments', icon: 'Calendar', resource: 'consultations', level: 'view', also: ['/doctor/consultation'] },
    { section: 'Clinical', label: 'Patient records', href: '/doctor/patients', icon: 'Users', resource: 'doctor.patients', level: 'view' },
    { section: 'Clinical', label: 'Earnings', href: '/doctor/earnings', icon: 'Banknote', resource: 'doctor.earnings', level: 'view' },
    { section: 'Clinical', label: 'Practice profile', href: '/doctor/profile', icon: 'User', resource: 'doctor.profile', level: 'view' },
    // Pharmacy
    { section: 'Pharmacy', label: 'Prescriptions', href: '/pharmacist/prescriptions', icon: 'FileText', resource: 'pharmacy.dispensing', level: 'view', also: ['/pharmacist/dispense'] },
    { section: 'Pharmacy', label: 'Inventory', href: '/pharmacist/inventory', icon: 'Package', resource: 'pharmacy.inventory', level: 'view' },
    { section: 'Pharmacy', label: 'Alerts', href: '/pharmacist/alerts', icon: 'AlertTriangle', resource: 'pharmacy.alerts', level: 'view' },
    // Laboratory
    { section: 'Laboratory', label: 'Lab requests', href: '/lab-assistant', icon: 'FlaskConical', resource: 'lab.requests', level: 'view' },
    { section: 'Laboratory', label: 'Lab tests', href: '/lab-assistant/tests', icon: 'ClipboardList', resource: 'lab.tests', level: 'view' },
    // Billing
    { section: 'Billing', label: 'Billing', href: '/receptionist/billing', icon: 'Banknote', resource: 'billing', level: 'view' },
    // HR
    { section: 'HR', label: 'Employees', href: '/hr/employees', icon: 'Users', resource: 'hr.employees', level: 'view' },
    { section: 'HR', label: 'Roster', href: '/hr/roster', icon: 'CalendarDays', resource: 'hr.roster', level: 'view' },
    { section: 'HR', label: 'Attendance', href: '/hr/attendance', icon: 'ClipboardCheck', resource: 'hr.attendance', level: 'view' },
    { section: 'HR', label: 'Leave', href: '/hr/leave', icon: 'CalendarOff', resource: 'hr.leave', level: 'view' },
    { section: 'HR', label: 'HR settings', href: '/hr/settings', icon: 'SlidersHorizontal', resource: 'hr.settings', level: 'view' },
    // Administration
    { section: 'Administration', label: 'Revenue', href: '/admin/revenue', icon: 'Banknote', resource: 'admin.revenue', level: 'view' },
    { section: 'Administration', label: 'Users', href: '/admin/users', icon: 'Users', resource: 'admin.users', level: 'view' },
    { section: 'Administration', label: 'Doctors', href: '/admin/doctors', icon: 'HeartPulse', resource: 'admin.doctors', level: 'view' },
    { section: 'Administration', label: 'Audit log', href: '/admin/logs', icon: 'FileText', resource: 'admin.audit', level: 'view' },
    { section: 'Administration', label: 'Access control', href: '/admin/access', icon: 'ShieldCheck', resource: 'access.config', level: 'view' },
    // Self-service
    { section: 'Me', label: 'My Work', href: '/staff/work', icon: 'Clock', resource: 'my.work', level: 'view' },
    { section: 'Me', label: 'Account', href: '/staff/account', icon: 'UserCog', resource: 'my.account', level: 'view' },
];

const allows = (grants: GrantMap, s: Pick<Screen, 'resource' | 'level'>) => Boolean(grants[s.resource]?.[s.level]);

/** The screens a person's permissions open, in menu order. */
export const screensFor = (grants: GrantMap): Screen[] => SCREENS.filter((s) => allows(grants, s));

// A section root such as /doctor is only that page itself: pages beneath it are their own screens (or closed)
const underPath = (pathname: string, base: string) => pathname === base || (base.split('/').length > 2 && pathname.startsWith(base + '/'));

/** The screen a path belongs to (the most specific match), or null for pages that are open to every member of staff. */
export function screenAt(pathname: string): Screen | null {
    let best: Screen | null = null, bestLen = -1;
    for (const s of SCREENS) {
        for (const base of [s.href, ...(s.also ?? [])]) {
            if (underPath(pathname, base) && base.length > bestLen) { best = s; bestLen = base.length; }
        }
    }
    return best;
}

/** The one staff page that is not a screen: it only sends people to their start screen (or says they have none). */
const HOME_PATH = '/staff';

/**
 * Whether a person may open this path. Every staff page is a screen in the list above, so a page that is not in the list
 * is closed to everyone (a new page cannot be forgotten and left open).
 */
export function mayOpen(grants: GrantMap, pathname: string): boolean {
    if (pathname === HOME_PATH) return true;
    const screen = screenAt(pathname);
    return screen ? allows(grants, screen) : false;
}

/** Where a person lands after signing in: the dashboard that suits their role, else the first screen they can open, else null. */
export function homeFor(role: string, grants: GrantMap): string | null {
    const first: Record<string, string[]> = {
        RECEPTIONIST: ['/receptionist'], DOCTOR: ['/doctor'], PHARMACIST: ['/pharmacist'], LAB_ASSISTANT: ['/lab-assistant'],
        HR_MANAGER: ['/hr'], ADMIN: ['/admin'],
    };
    const open = screensFor(grants);
    for (const href of first[role] ?? []) if (open.some((s) => s.href === href)) return href;
    return (open.find((s) => s.section === 'Dashboards') ?? open[0])?.href ?? null;
}
