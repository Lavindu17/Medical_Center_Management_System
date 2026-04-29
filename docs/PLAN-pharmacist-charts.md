# Plan: Pharmacist Dashboard Charts

This plan outlines the approach to enhance the Pharmacist Dashboard with interactive Recharts visualizations, providing valuable, comparable information about inventory status and pharmacy revenue.

## Socratic Gate Check
- **Data Scope**: The dashboard will display pharmacy-specific revenue (medicine sales) and inventory valuation. Do we need to restrict this to the last 30 days by default, similar to the Admin Revenue dashboard? I will assume a default 30-day view.
- **Chart Types**: I will implement a Daily Dispensing Trend (AreaChart) and an Inventory Valuation vs. Write-offs summary (BarChart), plus a Top Categories (PieChart).

## Proposed Changes

### Backend Updates
#### [NEW] `src/app/api/pharmacist/chart-data/route.ts`
- Create a new API endpoint to supply data specifically for the pharmacist's charts.
- **Authentication**: Verify the user is a `PHARMACIST`.
- **Query Strategy**:
    - **Daily Dispensing & Revenue**: Query `prescription_items` (joined with `medicines` and `prescriptions`) for the last 30 days where status is `DISPENSED`. Group by date to get daily dispensed quantity and generated revenue.
    - **Inventory Valuation**: Query `inventory_batches` to calculate the total `asset_value` (non-expired stock) and `write_off_value` (expired stock).
    - **Top Categories**: Group dispensed items by `category` (from `medicines` table) to get the revenue split.

### Frontend Updates
#### [MODIFY] `src/app/(dashboard)/pharmacist/page.tsx`
- Add a new state variable: `const [chartData, setChartData] = useState(null)`.
- Fetch data from `/api/pharmacist/chart-data` alongside the existing `stats` API call.
- Implement Recharts components:
    - **AreaChart**: Daily Revenue & Dispensed Units trend.
    - **PieChart**: Revenue by Medicine Category.
    - **BarChart**: Inventory Asset Value vs. Write-offs.
- Apply the system's Emerald/Mint (`THEME.primary`, `THEME.mint`, etc.) color palette to ensure consistency with the Admin Revenue dashboard.
- Add `framer-motion` for smooth entrance animations.
- Implement `SkeletonKpiRow` or custom skeleton loaders for loading states.

## Verification Checklist
- [ ] API endpoint returns daily dispensing stats, inventory valuation, and category splits correctly.
- [ ] Revenue calculations accurately reflect medicine selling prices multiplied by dispensed quantities.
- [ ] Frontend successfully fetches and renders chart data using Recharts.
- [ ] The UI adheres strictly to the Emerald design system (no blue/purple colors).
- [ ] The page gracefully handles empty states and loading states.
