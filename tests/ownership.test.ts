import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from './helpers/state';
import { tokenFor } from './helpers/auth';
import { pool, query } from '@/lib/db';

// Plan section 1.2: authenticated users must only reach their own data.
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('patient ownership', () => {
    beforeEach(async () => { state.token = await tokenFor('PATIENT', 5); vi.mocked(query).mockReset().mockResolvedValue([]); });

    it('cannot read another patient\'s records', async () => {
        const { GET } = await import('@/app/api/patient/records/route');
        const res = await GET(new Request('http://x/api/patient/records?patientId=6&type=bills'));
        expect(res.status).toBe(403);
    });

    it('records query is always bound to the session user, never the query string', async () => {
        const { GET } = await import('@/app/api/patient/records/route');
        await GET(new Request('http://x/api/patient/records?type=bills'));
        const calls = vi.mocked(query).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][1]).toEqual(['5']);
    });

    it('cannot read or write another patient\'s profile', async () => {
        const { GET, POST } = await import('@/app/api/patient/profile/route');
        expect((await GET(new Request('http://x/api/patient/profile?userId=6'))).status).toBe(403);
        expect((await POST(new Request('http://x/api/patient/profile', json({ id: 6, name: 'x', phone: '1' })))).status).toBe(403);
    });

    it('cannot book for another patient', async () => {
        const { POST } = await import('@/app/api/appointments/route');
        const res = await POST(new Request('http://x/api/appointments', json({ patientId: 6, doctorId: 2, date: '2030-01-01', timeSlot: '10:00' })));
        expect(res.status).toBe(403);
    });

    it('cannot list a doctor\'s or another patient\'s appointments', async () => {
        const { GET } = await import('@/app/api/appointments/route');
        expect((await GET(new Request('http://x/api/appointments?doctorId=2'))).status).toBe(403);
        expect((await GET(new Request('http://x/api/appointments?patientId=6'))).status).toBe(403);
    });

    it('cannot cancel or view someone else\'s appointment', async () => {
        vi.mocked(query).mockResolvedValue([{ patient_id: 6, doctor_id: 2, status: 'PENDING' }]);
        const cancel = await import('@/app/api/appointments/cancel/route');
        const res = await cancel.PUT(new Request('http://x', { ...json({ appointmentId: 9 }), method: 'PUT' }));
        expect(res.status).toBe(403);
        const detail = await import('@/app/api/appointments/[id]/route');
        const r2 = await detail.GET(new Request('http://x'), { params: Promise.resolve({ id: '9' }) });
        expect(r2.status).toBe(403);
    });

    it('cannot cancel a completed appointment', async () => {
        vi.mocked(query).mockResolvedValue([{ patient_id: 5, doctor_id: 2, status: 'COMPLETED' }]);
        const cancel = await import('@/app/api/appointments/cancel/route');
        const res = await cancel.PUT(new Request('http://x', { ...json({ appointmentId: 9 }), method: 'PUT' }));
        expect(res.status).toBe(409);
    });
});

describe('doctor ownership', () => {
    beforeEach(async () => { state.token = await tokenFor('DOCTOR', 2); vi.mocked(query).mockReset().mockResolvedValue([]); });

    it('cannot open another doctor\'s consultation', async () => {
        vi.mocked(query).mockResolvedValue([{ id: 9, doctor_id: 3, patient_id: 5, date_of_birth: '1990-01-01' }]);
        const { GET } = await import('@/app/api/doctor/consultation/[id]/route');
        const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: '9' }) });
        expect(res.status).toBe(403);
    });

    it('cannot save another doctor\'s consultation', async () => {
        vi.mocked(pool.execute).mockResolvedValueOnce([[{ doctor_id: 3 }], []] as any);
        const { POST } = await import('@/app/api/doctor/consultation/save/route');
        const res = await POST(new Request('http://x', json({ appointmentId: 9, status: 'COMPLETED', vitals: {} })));
        expect(res.status).toBe(403);
    });

    it('rejects invalid consultation status and missing appointment', async () => {
        const { POST } = await import('@/app/api/doctor/consultation/save/route');
        expect((await POST(new Request('http://x', json({ appointmentId: 9, status: 'CANCELLED' })))).status).toBe(400);
        vi.mocked(pool.execute).mockResolvedValueOnce([[], []] as any);
        expect((await POST(new Request('http://x', json({ appointmentId: 9, status: 'ONGOING' })))).status).toBe(404);
    });
});

describe('admin safeguards', () => {
    beforeEach(async () => { state.token = await tokenFor('ADMIN', 1); vi.mocked(query).mockReset().mockResolvedValue([]); });

    it('cannot delete own account or pass a bad id', async () => {
        const { DELETE } = await import('@/app/api/users/route');
        expect((await DELETE(new Request('http://x/api/users?id=1', { method: 'DELETE' }))).status).toBe(400);
        expect((await DELETE(new Request('http://x/api/users?id=abc', { method: 'DELETE' }))).status).toBe(400);
    });

    it('cannot demote self', async () => {
        const { PUT } = await import('@/app/api/users/route');
        const res = await PUT(new Request('http://x', { ...json({ id: 1, name: 'Admin', email: 'a@b.co', role: 'DOCTOR' }), method: 'PUT' }));
        expect(res.status).toBe(400);
    });
});
