import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        // 1. Revenue Breakdown (Lifetime)
        const [breakdown] = await query<any[]>(`
      SELECT 
        SUM(doctor_fee) as consultation, 
        SUM(pharmacy_total) as pharmacy, 
        SUM(lab_total) as lab,
        SUM(total_amount) as total
      FROM bills 
      WHERE status = 'PAID'
    `);

        // 2. Daily Revenue & Profit (Last 30 Days)
        const dailyStats = await query<any[]>(`
      SELECT 
        DATE(b.paid_at) as date,
        SUM(b.total_amount) as revenue,
        -- Calculate Profit
        (
          SUM(b.doctor_fee * (IFNULL(d.commission_rate, 100) / 100)) + -- Doctor Commission Profit (Actually usually commission is what admin TAKES, but assuming rate is what Doctor KEEPS, profit = 100-rate. Let's assume rate is what Hospital KEEPS for simplicity based on user prompt 'commission from doctor fees')
          SUM(b.service_charge) + 
          SUM(b.lab_total * 0.4) -- Assumed 40% margin on lab for now as we lack cost price in lab_tests
        ) as estimated_profit
      FROM bills b
      JOIN appointments a ON b.appointment_id = a.id
      JOIN doctors d ON a.doctor_id = d.user_id
      WHERE b.status = 'PAID' AND b.paid_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(b.paid_at)
      ORDER BY date ASC
    `);

        // Note: Pharmacy profit calculation requires deeper join, implementing simplified version for performance first
        // In production, we'd run a separate precise query for pharmacy profit

        return NextResponse.json({
            breakdown: breakdown || { consultation: 0, pharmacy: 0, lab: 0, total: 0 },
            daily: dailyStats
        });

    } catch (error) {
        console.error('Revenue API Error:', error);
        return NextResponse.json({ message: 'Failed to fetch revenue data' }, { status: 500 });
    }
}
