/**
 * The catalogue of things staff can be given access to. This is the single source of truth: the configuration window,
 * the menus, the page guards and every API route read from here, so a screen cannot exist without being listed.
 *
 * Four levels, each meaning something concrete on each resource:
 *   view     see it
 *   add      create new items
 *   change   edit existing items
 *   approve  make the final decision (dispense, mark paid, decide a leave request ...)
 *
 * Patients are the customer side and are not part of this: their access is fixed.
 */

export const LEVELS = ['view', 'add', 'change', 'approve'] as const;
export type Level = (typeof LEVELS)[number];

export const MODULES = ['Front desk', 'Clinical', 'Pharmacy', 'Laboratory', 'Billing', 'HR', 'Administration'] as const;
export type ModuleName = (typeof MODULES)[number];

export interface ResourceDef {
    key: string;
    label: string;
    module: ModuleName;
    /** What the screen is for, shown beside it in the configuration window */
    description: string;
    /** Only the levels that mean something here, each with what it allows. */
    levels: Partial<Record<Level, string>>;
}

const def = <K extends string>(key: K, module: ModuleName, label: string, description: string, levels: ResourceDef['levels']) =>
    ({ key, module, label, description, levels }) as const;

export const RESOURCE_LIST = [
    // Front desk
    def('reception.dashboard', 'Front desk', 'Reception dashboard', "Today's queues, bookings by hour and bills to collect.", { view: 'See the dashboard' }),
    def('reception.appointments', 'Front desk', 'Appointments (front desk)', 'The day\'s appointments for every doctor, booking for patients and checking them in.',
        { view: 'See appointments', add: 'Book for a patient', change: 'Check in, change status, cancel' }),
    def('reception.patients', 'Front desk', 'Patient registration and directory', 'Register walk-in patients and look patients up.',
        { view: 'Search patients', add: 'Register a new patient', change: 'Link family members' }),
    // Clinical
    def('doctor.dashboard', 'Clinical', 'Doctor dashboard', "A doctor's own day: queue, charts and completion rate.", { view: 'See the dashboard' }),
    def('consultations', 'Clinical', 'Consultations', "A doctor's own appointments and the consultation screen: notes, prescription and lab requests.",
        { view: 'See own appointments and visits', add: 'Write notes, prescribe and request tests', change: 'Cancel appointments', approve: 'Complete the consultation (creates the bill)' }),
    def('doctor.patients', 'Clinical', 'Patient records', "The patients a doctor has seen and their history.", { view: 'Open patient records' }),
    def('doctor.earnings', 'Clinical', 'Earnings', "A doctor's own earnings.", { view: 'See own earnings' }),
    def('doctor.profile', 'Clinical', 'Practice profile', "A doctor's own details and fee.", { view: 'See the profile', change: 'Edit details and fee' }),
    // Pharmacy
    def('pharmacy.dashboard', 'Pharmacy', 'Pharmacy dashboard', 'Prescriptions waiting, stock value and what is selling.', { view: 'See the dashboard' }),
    def('pharmacy.dispensing', 'Pharmacy', 'Prescriptions and dispensing', 'The prescription queue and the dispensing room.',
        { view: 'See prescriptions', approve: 'Dispense or reject medicines' }),
    def('pharmacy.inventory', 'Pharmacy', 'Inventory', 'Medicines and stock batches.',
        { view: 'See stock', add: 'Add medicines and batches', change: 'Edit or remove medicines' }),
    def('pharmacy.alerts', 'Pharmacy', 'Expiry and stock alerts', 'Medicines running low or about to expire.', { view: 'See alerts' }),
    // Laboratory
    def('lab.dashboard', 'Laboratory', 'Lab dashboard', 'Waiting results, turnaround time and the 14-day trend.', { view: 'See the dashboard' }),
    def('lab.requests', 'Laboratory', 'Lab requests and results', 'Tests requested by doctors and uploading their results.',
        { view: 'See requests and reports', add: 'Upload a result' }),
    def('lab.tests', 'Laboratory', 'Lab test catalogue', 'The tests offered and their prices.', { view: 'See the tests', add: 'Add a test' }),
    // Billing
    def('billing', 'Billing', 'Billing', 'Patient bills.', { view: 'See bills', approve: 'Record a payment' }),
    // HR
    def('hr.overview', 'HR', 'HR overview', 'Who is in, late, absent or on leave today.', { view: 'See the overview' }),
    def('hr.roster', 'HR', 'Roster', 'Shifts for every employee.', { view: 'See the roster', add: 'Assign shifts', change: 'Change or remove shifts' }),
    def('hr.attendance', 'HR', 'Attendance', 'Clock records and correction requests.',
        { view: 'See attendance', add: 'Add a missing record', change: 'Edit or delete records', approve: 'Decide correction requests' }),
    def('hr.leave', 'HR', 'Leave', 'Leave requests and balances.', { view: 'See leave requests', approve: 'Approve or reject leave' }),
    def('hr.employees', 'HR', 'Employees', 'Employee profiles.', { view: 'See employees', change: 'Edit employee details' }),
    def('hr.settings', 'HR', 'HR settings', 'Time zone, grace period, leave types, holidays and shift presets.', { view: 'See settings', change: 'Change settings' }),
    // Administration
    def('admin.dashboard', 'Administration', 'Admin dashboard', 'The clinic overview.', { view: 'See the dashboard' }),
    def('admin.revenue', 'Administration', 'Revenue analytics', 'Revenue, profit and payouts. Clinic-wide money.', { view: 'See revenue' }),
    def('admin.users', 'Administration', 'User management', 'Staff and patient accounts.', { view: 'See users', add: 'Create users', change: 'Edit or remove users' }),
    def('admin.doctors', 'Administration', 'Doctor management', "Doctors' fees, commission, working hours and time off.", { view: 'See doctors', change: 'Change fees, hours and time off' }),
    def('admin.audit', 'Administration', 'Audit log', 'Who did what, and verifying the log.', { view: 'See and export the log', approve: 'Verify the log' }),
    def('access.config', 'Administration', 'Access control', 'This configuration window: who can do what.', { view: 'See permissions', change: 'Change permissions' }),
] as const;

export type ResourceKey = (typeof RESOURCE_LIST)[number]['key'];

export const RESOURCES: Record<ResourceKey, ResourceDef> = Object.fromEntries(RESOURCE_LIST.map((r) => [r.key, r])) as Record<ResourceKey, ResourceDef>;
export const RESOURCE_KEYS = RESOURCE_LIST.map((r) => r.key) as ResourceKey[];

export const isResource = (key: unknown): key is ResourceKey => typeof key === 'string' && key in RESOURCES;
export const isLevel = (key: unknown): key is Level => typeof key === 'string' && (LEVELS as readonly string[]).includes(key);

/** The levels a resource actually offers, in display order. */
export const levelsOf = (key: ResourceKey): Level[] => LEVELS.filter((l) => RESOURCES[key].levels[l]);
