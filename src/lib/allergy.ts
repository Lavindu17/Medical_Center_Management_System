export interface AllergyRecord { name: string; severity?: string | null }
export interface MedicineNames { name?: string | null; generic_name?: string | null }

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Words in the medicine's name or generic name, without strengths and units ("Amoxicillin 500mg" -> amoxicillin). */
function words(med: MedicineNames): string[] {
    return [...new Set(`${norm(med.name)} ${norm(med.generic_name)}`.split(' ').filter((w) => w.length >= 4 && !/^\d/.test(w)))];
}

/**
 * Allergies that look like this medicine: an allergy matches when its text appears in the medicine's name or generic
 * name, or one of the medicine's words appears in the allergy ("penicillin allergy" against "Penicillin V").
 * This is a safety net for the doctor, not a drug database, so it errs towards warning.
 */
export function allergyMatches(med: MedicineNames, allergies: AllergyRecord[]): AllergyRecord[] {
    const haystack = `${norm(med.name)} ${norm(med.generic_name)}`;
    const medWords = words(med);
    return allergies.filter((a) => {
        const needle = norm(a.name);
        if (needle.length < 3) return false;
        if (haystack.includes(needle)) return true;
        const allergyWords = needle.split(' ').filter((w) => w.length >= 4);
        return medWords.some((w) => allergyWords.includes(w));
    });
}
