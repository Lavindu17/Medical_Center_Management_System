export type MedicineForm = 'Pill' | 'Syrup' | 'Cream';

interface MedicineLike {
    name?: string | null;
    unit?: string | null;
    dosage_form?: string | null;
}

/**
 * How a medicine is taken, which decides the prescription form (tablet counts vs. a single bottle or tube).
 * The recorded dosage form wins; otherwise the unit is matched as a whole word so that "mg" (a strength) is not
 * mistaken for "g" (grams of cream).
 */
export function medicineForm(med: MedicineLike): MedicineForm {
    switch ((med.dosage_form ?? '').toUpperCase()) {
        case 'SYRUP': return 'Syrup';
        case 'CREAM': return 'Cream';
        case 'TABLET':
        case 'CAPSULE':
        case 'INJECTION': return 'Pill';
    }

    const name = (med.name ?? '').toLowerCase();
    const unit = (med.unit ?? '').toLowerCase();
    if (/\b(ml|millilit(re|er)s?|bottles?|litres?|liters?)\b/.test(unit) || /syr|liquid/.test(name)) return 'Syrup';
    if (/\b(tubes?|g|gm|grams?)\b/.test(unit) || /cream|oint/.test(name)) return 'Cream';
    return 'Pill';
}
