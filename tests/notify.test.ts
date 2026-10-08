import { describe, it, expect } from 'vitest';
import { asDoctor, when } from '@/lib/notify';
import { escapeHtml, escapeLike } from '@/lib/html';

describe('asDoctor', () => {
    it.each([
        ['Dr. Jane Doe', 'Dr. Jane Doe'],
        ['dr. jane doe', 'dr. jane doe'],
        ['Dr Jane Doe', 'Dr Jane Doe'],
        ['  Dr. Jane Doe  ', 'Dr. Jane Doe'],
        ['Jane Doe', 'Dr. Jane Doe'],
        ['Drew Barrymore', 'Dr. Drew Barrymore'],   // a name that merely starts with "Dr" is not a title
        ['Dryden Lee', 'Dr. Dryden Lee'],
    ])('%s -> %s', (input, expected) => {
        expect(asDoctor(input)).toBe(expected);
    });
});

describe('when', () => {
    it('formats a date with and without a time', () => {
        expect(when('2030-01-07', '10:00:00')).toBe('7 Jan 2030, 10:00');
        expect(when('2030-01-07')).toBe('7 Jan 2030');
    });
});

describe('html helpers', () => {
    it('escapes markup, quotes and ampersands', () => {
        expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
        expect(escapeHtml(null)).toBe('');
    });

    it('escapes LIKE wildcards and the escape character', () => {
        expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    });
});
