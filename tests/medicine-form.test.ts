import { describe, it, expect } from 'vitest';
import { medicineForm } from '@/lib/medicine-form';

describe('medicineForm', () => {
    it.each([
        [{ name: 'Paracetamol 500mg', unit: 'mg' }, 'Pill'],              // "mg" is a strength, not grams
        [{ name: 'Amoxicillin', unit: 'capsules' }, 'Pill'],
        [{ name: 'Cetirizine 10mg', unit: 'tablets' }, 'Pill'],
        [{ name: 'Cough Syrup 100ml', unit: 'bottles' }, 'Syrup'],
        [{ name: 'Saline', unit: 'ml' }, 'Syrup'],
        [{ name: 'Oral rehydration', unit: '500 ml bottle' }, 'Syrup'],
        [{ name: 'Hydrocortisone', unit: 'tube' }, 'Cream'],
        [{ name: 'Clotrimazole', unit: '15 g' }, 'Cream'],
        [{ name: 'Povidone ointment', unit: 'jar' }, 'Cream'],
        [{ name: 'Mystery', unit: '' }, 'Pill'],
        [{ name: 'Mystery', unit: null }, 'Pill'],
    ])('%j -> %s', (med, expected) => {
        expect(medicineForm(med)).toBe(expected);
    });

    it('the recorded dosage form wins over guessing from the unit', () => {
        expect(medicineForm({ name: 'X', unit: 'mg', dosage_form: 'CREAM' })).toBe('Cream');
        expect(medicineForm({ name: 'Cream-like name', unit: 'tube', dosage_form: 'TABLET' })).toBe('Pill');
        expect(medicineForm({ name: 'X', unit: 'tablets', dosage_form: 'SYRUP' })).toBe('Syrup');
        expect(medicineForm({ name: 'Syringe', unit: 'vial', dosage_form: 'INJECTION' })).toBe('Pill');
    });
});
