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

        // ── Parse + validate month/year filters ─────────────────────────────────
        const { searchParams } = new URL(req.url);
        const now = new Date();
        const month = Math.min(12, Math.max(1, parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10)));
        const year  = Math.min(2100, Math.max(2000, parseInt(searchParams.get('year')  || String(now.getFullYear()), 10)));

        // Shared date filter clause for bills (used in revenue, doctor queries)
        // MONTH()/YEAR() are safe — values are sanitised integers above, not raw strings
        const billsDateFilter = `b.status = 'PAID' AND MONTH(b.paid_at) = ${month} AND YEAR(b.paid_at) = ${year}`;

        // ── 1. Gross Revenue ─────────────────────────────────────────────────────
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
            WHERE ${billsDateFilter}
        `);

        // ── 2. Medicine COGS — dispensed within the selected month ───────────────
        const cogsRows: any = await query(`
            SELECT COALESCE(SUM(pi.dispensed_quantity * COALESCE(m.buying_price, 0)), 0) as medicine_cogs
            FROM prescription_items pi
            JOIN medicines m ON m.id = pi.medicine_id
            JOIN prescriptions pr ON pr.id = pi.prescription_id
            JOIN appointments a ON a.id = pr.appointment_id
            JOIN bills b ON b.appointment_id = a.id
            WHERE pi.status IN ('DISPENSED', 'PARTIALLY_COMPLETED')
              AND pi.dispensed_quantity > 0
              AND b.status = 'PAID'
              AND MONTH(b.paid_at) = ${month}
              AND YEAR(b.paid_at) = ${year}
        `);

        // ── 3. Lab COGS — completed tests billed in selected month ───────────────
        const labCogsRows: any = await query(`
            SELECT COALESCE(SUM(lt.cost_price), 0) as lab_cogs
            FROM lab_requests lr
            JOIN lab_tests lt ON lt.id = lr.test_id
            JOIN appointments a ON a.id = lr.appointment_id
            JOIN bills b ON b.appointment_id = a.id
            WHERE lr.status = 'COMPLETED'
              AND b.status = 'PAID'
              AND MONTH(b.paid_at) = ${month}
              AND YEAR(b.paid_at) = ${year}
        `);

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
            WHERE b.status = 'PAID'
              AND a.status = 'COMPLETED'
              AND MONTH(b.paid_at) = ${month}
              AND YEAR(b.paid_at) = ${year}
        `);

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
            WHERE a.status = 'COMPLETED'
              AND b.status = 'PAID'
              AND MONTH(b.paid_at) = ${month}
              AND YEAR(b.paid_at) = ${year}
            GROUP BY a.doctor_id, u.name, d.specialization, d.commission_rate
            ORDER BY net_payout DESC
        `);

        // ── 7. Daily revenue — every day in the selected month ───────────────────
        const dailyRevenue: any = await query(`
            SELECT
                DATE(b.paid_at) as date,
                COALESCE(SUM(b.service_charge + b.doctor_fee * d.commission_rate / 100 + b.lab_total + b.pharmacy_total), 0) as gross_revenue,
                COALESCE(SUM(b.total_amount), 0) as patient_billed
            FROM bills b
            JOIN appointments a ON a.id = b.appointment_id
            JOIN doctors d ON d.user_id = a.doctor_id
            WHERE b.status = 'PAID'
              AND MONTH(b.paid_at) = ${month}
              AND YEAR(b.paid_at) = ${year}
            GROUP BY DATE(b.paid_at)
            ORDER BY date ASC
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
            daily:          dailyRevenue,
        });

    } catch (error) {
        console.error('Revenue API Error:', error);
        return NextResponse.json({ message: 'Failed to fetch revenue data' }, { status: 500 });
    }
}
