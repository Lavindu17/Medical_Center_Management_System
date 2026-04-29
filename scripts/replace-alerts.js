/**
 * Replace all bare alert() calls with sonner toast() and inject the import.
 */
const fs = require('fs');
const path = require('path');

const dashboardDir = path.join(__dirname, '../src/app/(dashboard)');

const SUCCESS_KEYWORDS = ['success', 'Success', 'Successfully', 'successfully',
    'updated', 'Updated', 'linked', 'Linked', 'booked', 'Booked',
    'switched', 'Switched', 'saved', 'Saved', 'sent', 'Sent', 'done', 'Done'];

const ERROR_KEYWORDS = ['error', 'Error', 'failed', 'Failed', 'fail', 'Fail'];

function collectFiles(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results = results.concat(collectFiles(full));
        else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) results.push(full);
    }
    return results;
}

function classifyAlert(arg) {
    const clean = arg.replace(/['"]/g, '').toLowerCase();
    if (SUCCESS_KEYWORDS.some(k => clean.includes(k.toLowerCase()))) return 'toast.success';
    if (ERROR_KEYWORDS.some(k => clean.includes(k.toLowerCase()))) return 'toast.error';
    if (clean.includes('message') || clean.includes('err')) return 'toast.error';
    return 'toast';
}

function replaceAlerts(content) {
    // Match alert(anything) — naive but works for single-line usages
    return content.replace(/\balert\(([^)]+)\)/g, (match, arg) => {
        const fn = classifyAlert(arg);
        return fn + '(' + arg + ')';
    });
}

function ensureImport(content) {
    if (content.includes("from 'sonner'") || content.includes('from "sonner"')) return content;

    // After 'use client';
    if (content.includes("'use client'")) {
        return content.replace(/('use client';?\r?\n)/, "$1import { toast } from 'sonner';\n");
    }
    // Prepend to first import
    return "import { toast } from 'sonner';\n" + content;
}

const files = collectFiles(dashboardDir);
let total = 0;

for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    if (!original.includes('alert(')) continue;

    let updated = replaceAlerts(original);
    updated = ensureImport(updated);

    fs.writeFileSync(file, updated, 'utf8');
    const count = (original.match(/\balert\(/g) || []).length;
    console.log(`✅ ${path.relative(dashboardDir, file)} (${count} alert(s))`);
    total += count;
}

console.log(`\nReplaced ${total} alert() calls across ${files.filter(f => {
    const c = fs.readFileSync(f, 'utf8');
    return c.includes('toast(') || c.includes('toast.success') || c.includes('toast.error');
}).length} files.`);
