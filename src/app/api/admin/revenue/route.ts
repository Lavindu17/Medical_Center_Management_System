import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { AuthService } from '@/services/auth.service';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const user = await AuthService.verifyToken(token || '');
        if (!user || user.role !== 'ADMIN') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        let startDate = searchParams.get('startDate');
        let endDate = searchParams.get('endDate');

        if (!startDate || !endDate) {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            // Format to YYYY-MM-DD
            const pad = (n: number) => n.toString().padStart(2, '0');
            startDate = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
            endDate = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
        }

        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        // ── 1. Gross Revenue (only the center's income) ─────────────────────────
        const revenueRows: any = await query(`
            SELECT
                COALESCE(SUM(b.service_charge), 0) as service_charges,
                COALESCE(SUM(b.doctor_fee * d.commission_rate / 100), 0) as doctor_commissions,
                COALESCE(SUM(b.lab_total), 0) as lab_revenue,
                COALESCE(SUM(b.pharmacy_total), 0) as pharmacy_revenue,
                COALESCE(SUM(
                    b.service_charge +
                    b.doctor_fee * d.commission_rate / 100 +
                    b.lab_total +
                    b.pharmacy_total
                ), 0) as gross_revenue
            FROM bills b
            JOIN appointments a ON a.id = b.appointment_id
            JOIN doctors d ON d.user_id = a.doctor_id
            WHERE b.status = 'PAID' AND b.paid_at >= ? AND b.paid_at <= ?
        `, [startDateTime, endDateTime]);

        // ── 2. Medicine COGS — dispensed within the selected month ───────────────
        const cogsRows: any = await query(`
            SELECT COALESCE(SUM(pi.dispensed_quantity * COALESCE(
                (SELECT buying_price FROM inventory_batches ib WHERE ib.medicine_id = pi.medicine_id ORDER BY id DESC LIMIT 1), 0
            )), 0) as medicine_cogs
            FROM prescription_items pi
            JOIN medicines m ON m.id = pi.medicine_id
            JOIN prescriptions p ON p.id = pi.prescription_id
            WHERE pi.status IN ('DISPENSED', 'PARTIALLY_COMPLETED')
              AND pi.dispensed_quantity > 0
              AND p.issued_at >= ? AND p.issued_at <= ?
        `, [startDateTime, endDateTime]);

        // ── 3. Lab COGS — completed tests billed in selected month ───────────────
        const labCogsRows: any = await query(`
            SELECT COALESCE(SUM(lt.cost_price), 0) as lab_cogs
            FROM lab_requests lr
            JOIN lab_tests lt ON lt.id = lr.test_id
            WHERE lr.status = 'COMPLETED' AND lr.completed_at >= ? AND lr.completed_at <= ?
        `, [startDateTime, endDateTime]);

        // ── 4. Inventory Valuation — always a live balance-sheet snapshot ────────
        const inventoryRows: any = await query(`
            SELECT
                COALESCE(SUM(CASE WHEN expiry_date >= CURDATE() THEN quantity_current * buying_price ELSE 0 END), 0) as asset_value,
                COALESCE(SUM(CASE WHEN expiry_date < CURDATE() AND quantity_current > 0 THEN quantity_current * buying_price ELSE 0 END), 0) as write_off_value
            FROM inventory_batches
        `);

        // ── 5. Doctor net payouts for selected month ──────────────────────────────
        const doctorNetRows: any = await query(`
            SELECT COALESCE(SUM(b.doctor_fee * (1 - d.commission_rate / 100)), 0) as total_doctor_payouts
            FROM bills b
            JOIN appointments a ON a.id = b.appointment_id
            JOIN doctors d ON d.user_id = a.doctor_id
            WHERE b.status = 'PAID' AND a.status = 'COMPLETED'
              AND b.paid_at >= ? AND b.paid_at <= ?
        `, [startDateTime, endDateTime]);

        // ── 6. Per-doctor breakdown for selected month ────────────────────────────
        const doctorPayouts: any = await query(`
            SELECT
                u.name as doctor_name,
                d.specialization,
                d.commission_rate,
                COUNT(a.id) as completed_appointments,
                COALESCE(SUM(b.doctor_fee), 0) as gross_charged,
                COALESCE(SUM(b.doctor_fee * d.commission_rate / 100), 0) as center_commission,
                COALESCE(SUM(b.doctor_fee * (1 - d.commission_rate / 100)), 0) as net_payout
            FROM appointments a
            JOIN bills b ON b.appointment_id = a.id
            JOIN doctors d ON d.user_id = a.doctor_id
            JOIN users u ON u.id = a.doctor_id
            WHERE a.status = 'COMPLETED' AND b.status = 'PAID'
              AND b.paid_at >= ? AND b.paid_at <= ?
            GROUP BY a.doctor_id, u.name, d.specialization, d.commission_rate
            ORDER BY net_payout DESC
        `, [startDateTime, endDateTime]);

        // ── 7. Daily revenue — every day in the selected month ───────────────────
        const dailyRevenue: any = await query(`
            SELECT
                DATE(b.paid_at) as date,
                COALESCE(SUM(b.service_charge + b.doctor_fee * d.commission_rate / 100 + b.lab_total + b.pharmacy_total), 0) as gross_revenue,
                COALESCE(SUM(b.total_amount), 0) as patient_billed
            FROM bills b
            JOIN appointments a ON a.id = b.appointment_id
            JOIN doctors d ON d.user_id = a.doctor_id
            WHERE b.status = 'PAID' AND b.paid_at >= ? AND b.paid_at <= ?
            GROUP BY DATE(b.paid_at)
            ORDER BY date ASC
        `, [startDateTime, endDateTime]);

        // ── 8. Monthly Revenue Trend (Last 12 Months) ────────────────────────────
        const monthlyRevenue: any = await query(`
            SELECT
                DATE_FORMAT(b.paid_at, '%Y-%m') as month,
                COALESCE(SUM(b.service_charge), 0) as service_charges,
                COALESCE(SUM(b.doctor_fee * d.commission_rate / 100), 0) as doctor_commissions,
                COALESCE(SUM(b.lab_total), 0) as lab_revenue,
                COALESCE(SUM(b.pharmacy_total), 0) as pharmacy_revenue,
                COALESCE(SUM(b.service_charge + b.doctor_fee * d.commission_rate / 100 + b.lab_total + b.pharmacy_total), 0) as gross_revenue,
                COALESCE(SUM(b.total_amount), 0) as patient_billed
            FROM bills b
            JOIN appointments a ON a.id = b.appointment_id
            JOIN doctors d ON d.user_id = a.doctor_id
            WHERE b.status = 'PAID'
            GROUP BY DATE_FORMAT(b.paid_at, '%Y-%m')
            ORDER BY month ASC
        `);

        // ── Build response ────────────────────────────────────────────────────────
        const r = revenueRows[0];
        const grossRevenue        = Number(r.gross_revenue);
        const medicineCogs        = Number(cogsRows[0].medicine_cogs);
        const labCogs             = Number(labCogsRows[0].lab_cogs);
        const totalCogs           = medicineCogs + labCogs;
        const totalDoctorPayouts  = Number(doctorNetRows[0].total_doctor_payouts);
        const writeOff            = Number(inventoryRows[0].write_off_value);
        const trueGrossProfit     = grossRevenue - totalCogs - totalDoctorPayouts - writeOff;

        return NextResponse.json({
            filter: { month, year },
            revenue: {
                service_charges:    Number(r.service_charges),
                doctor_commissions: Number(r.doctor_commissions),
                lab_revenue:        Number(r.lab_revenue),
                pharmacy_revenue:   Number(r.pharmacy_revenue),
                gross_revenue:      grossRevenue,
            },
            cogs: {
                medicine_cogs: medicineCogs,
                lab_cogs:      labCogs,
                total_cogs:    totalCogs,
            },
            inventory: {
                asset_value:    Number(inventoryRows[0].asset_value),
                write_off_value: writeOff,
            },
            profit: {
                total_doctor_payouts: totalDoctorPayouts,
                true_gross_profit:    trueGrossProfit,
            },
            doctor_payouts: doctorPayouts,
            daily: dailyRevenue,
            monthly: monthlyRevenue,
        });

    } catch (error) {
        console.error('Revenue API Error:', error);
        return NextResponse.json({ message: 'Failed to fetch revenue data' }, { status: 500 });
    }
}
