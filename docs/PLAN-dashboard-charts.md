# Plan: Dashboard Charts

This plan outlines the approach to replace the mock data in the Doctor Dashboard charts with real data fetched from the database.

## Socratic Gate Check
- **Current Stats Calculation**: The current stats endpoint (`/api/doctor/stats`) uses **Projected Revenue** (Appointments * Consultation Fee). I will use this same logic for the daily Revenue Trend chart to ensure consistency.

## Proposed Changes

### Backend Updates
#### [NEW] `src/app/api/doctor/chart-data/route.ts`
- Create a new API endpoint to supply data specifically for the charts.
- **Authentication**: Verify the user is a `DOCTOR`.
- **Query Strategy**:
    - Fetch the doctor's `consultation_fee`.
    - Query the `appointments` table for the last 7 days for this `doctor_id`, filtering out `CANCELLED` statuses.
    - Group the results by date.
- **Data Formatting**:
    - Generate an array of the last 7 days (e.g., 'Mon', 'Tue').
    - Map the queried database results into this array. If a day has no appointments, default to `0`.
    - Calculate revenue for each day as `appointment_count * consultation_fee`.

### Frontend Updates
#### [MODIFY] `src/app/(dashboard)/doctor/page.tsx`
- Add a new state variable: `const [chartData, setChartData] = useState([])`.
- Update the existing `useEffect` to fetch data from `/api/doctor/chart-data` alongside the `stats` API call.
- Replace `mockTrendData` with `chartData` in the `LineChart` and `BarChart` components.
- Render skeleton loaders or an empty state while `chartData` is loading.

## Verification Checklist
- [ ] API endpoint returns 7 days of data correctly.
- [ ] Revenue calculation matches `stats` calculation.
- [ ] Frontend successfully fetches and renders chart data.
- [ ] UI behaves gracefully when data is empty or loading.
