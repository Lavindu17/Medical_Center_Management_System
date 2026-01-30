
# Implementation Plan - Hardcoded Frontend Features

**Goal**: Implement missing frontend features and "mock" existing ones to demonstrate full system functionality without relying on backend/database completion.

## User Review Required
> [!IMPORTANT]
> This plan focuses on **Hardcoding Data** directly into the frontend components. This is temporary for demonstration purposes and will need to be replaced with real API calls later.

## Proposed Changes

### Patient Module
#### [MODIFY] [layout.tsx](file:///c:/Users/Tuf/Desktop/projects/Sethro%20Medical%20Center/src/app/(dashboard)/patient/layout.tsx)
-   **Feature**: Profile Switcher (Family Linking)
-   **Change**: Add a "Switch Profile" dropdown in the top navigation bar.
-   **Mock Data**: Hardcode a list of linked family members (e.g., "Child: Sam", "Spouse: Alex").
#### [MODIFY] [page.tsx](file:///c:/Users/Tuf/Desktop/projects/Sethro%20Medical%20Center/src/app/(dashboard)/patient/profile/page.tsx)
-   **Feature**: Family Account Linking Management
-   **Change**: Added a "Family Accounts" tab with hardcoded list of linked members and a hardcoded "Link New Family Member" form.


### Doctor Module
#### [MODIFY] [page.tsx](file:///c:/Users/Tuf/Desktop/projects/Sethro%20Medical%20Center/src/app/(dashboard)/doctor/page.tsx)
-   **Feature**: Dashboard Stats
-   **Change**: Replace `fetch('/api/doctor/stats')` with hardcoded state initialization to show realistic numbers for:
    -   Today's Appointments (e.g., 8)
    -   Total Revenue (e.g., LKR 45,000)
    -   Total Patients (e.g., 120)

### Receptionist Module
#### [MODIFY] [page.tsx](file:///c:/Users/Tuf/Desktop/projects/Sethro%20Medical%20Center/src/app/(dashboard)/receptionist/billing/page.tsx)
-   **Feature**: Master Bill Aggregation
-   **Change**: Hardcode the `bills` state validation to ensure at least 2-3 pending bills are visible with diverse charges (Doctor + Pharmacy + Lab).

### Admin Module
#### [MODIFY] [page.tsx](file:///c:/Users/Tuf/Desktop/projects/Sethro%20Medical%20Center/src/app/(dashboard)/admin/revenue/page.tsx)
-   **Feature**: Profit Calculation
-   **Change**: Ensure the chart and stats cards use hardcoded calculation logic to visually differentiate "Revenue" vs "Profit" (e.g., Profit = 30% of Revenue) if the API returns separate values or if strictly hardcoding is needed.

## Verification Plan

### Manual Verification
1.  **Patient**: Log in as patient, click "Switch Profile" in nav, verify distinct names appear.
2.  **Doctor**: Log in as doctor, verify Dashboard shows "8 Appointments" and "LKR 45,000" revenue immediately.
3.  **Receptionist**: Go to Billing, verify "Invoice #101" shows aggregated total of LKR 3,500 (1500 Fee + 1000 Pharm + 1000 Lab).
