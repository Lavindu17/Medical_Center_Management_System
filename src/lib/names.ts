/**
 * Doctors are stored as "Dr. Jane Doe" or just "Jane Doe". Show the title exactly once.
 * Safe for both server and client code (no database imports).
 */
export function asDoctor(name?: string | null): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return 'Doctor';
    return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

/** One letter for an avatar: the first letter of the first real name word, ignoring a leading title. */
export function initialOf(name?: string | null): string {
    const words = (name ?? '').trim().replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '').split(/\s+/);
    return (words[0]?.[0] ?? '?').toUpperCase();
}
