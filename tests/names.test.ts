import { describe, it, expect } from 'vitest';
import { asDoctor, initialOf } from '@/lib/names';

describe('asDoctor', () => {
    it.each([
        ['Dr. Jane Doe', 'Dr. Jane Doe'],
        ['dr jane doe', 'dr jane doe'],
        ['Jane Doe', 'Dr. Jane Doe'],
        ['  Jane Doe ', 'Dr. Jane Doe'],
        ['Drew Barrymore', 'Dr. Drew Barrymore'],
        [null, 'Doctor'],
        [undefined, 'Doctor'],
        ['   ', 'Doctor'],
    ])('%j -> %s', (input, expected) => {
        expect(asDoctor(input)).toBe(expected);
    });
});

describe('initialOf', () => {
    it.each([
        ['Dr. John Smith', 'J'],
        ['Jane Doe', 'J'],
        ['Prof. amal Perera', 'A'],
        ['Madonna', 'M'],
        ['Dr.', 'D'],
        ['', '?'],
        [null, '?'],
    ])('%j -> %s', (input, expected) => {
        expect(initialOf(input)).toBe(expected);
    });
});
