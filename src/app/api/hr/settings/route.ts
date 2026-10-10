import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { parseBody } from '@/lib/validate';
import { requireHr, hrFailure } from '@/lib/hr-auth';
import { loadSettings } from '@/lib/hr';

const validZone = (tz: string) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };

const schema = z.object({
    timezone: z.string().trim().refine(validZone, 'Choose a valid time zone, for example Asia/Colombo'),
    graceMinutes: z.number().int().min(0, 'Grace period cannot be negative').max(120, 'Grace period is too long'),
    earlyWindowMinutes: z.number().int().min(30).max(720),
    missingClockOutHours: z.number().int().min(8).max(48),
});

export async function GET() {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    try {
        return NextResponse.json({ settings: await loadSettings() });
    } catch (err) {
        return hrFailure(err, 'HR settings');
    }
}

export async function PUT(req: Request) {
    const auth = await requireHr();
    if ('error' in auth) return auth.error;
    const body = await parseBody(req, schema);
    if ('error' in body) return body.error;
    try {
        const s = body.data;
        const pairs: [string, string][] = [['timezone', s.timezone], ['grace_minutes', String(s.graceMinutes)], ['early_window_minutes', String(s.earlyWindowMinutes)], ['missing_clock_out_hours', String(s.missingClockOutHours)]];
        for (const [k, v] of pairs) await query('INSERT INTO hr_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [k, v]);
        await audit(auth.user, { action: 'UPDATE', entity: 'HR_SETTINGS', details: { ...s } as Record<string, unknown> });
        return NextResponse.json({ settings: await loadSettings() });
    } catch (err) {
        return hrFailure(err, 'HR save settings');
    }
}
