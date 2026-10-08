import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

// A "use client" directive that is not the very first statement is a compile error in Next.js that `tsc` does not
// report (the page just 500s in the browser). Scripted import edits caused this twice, so guard it.

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(name) ? [full] : [];
    });
}

describe('"use client" directive', () => {
    it('is the first statement in every file that has one', () => {
        const offenders = sourceFiles(path.resolve(__dirname, '../src')).filter((file) => {
            const text = readFileSync(file, 'utf8');
            const match = /^['"]use client['"];?\s*$/m.exec(text);
            return match !== null && text.slice(0, match.index).trim() !== '';
        });
        expect(offenders).toEqual([]);
    });
});
