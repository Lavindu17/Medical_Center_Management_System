
# Implementation Plan - Receptionist Module

**Goal**: Implement the Receptionist and Cashier workflows to manage patient flow, registration, and final billing.

## User Review Required
> [!NOTE]
> The "Family Link" verification process is manual. The Receptionist will need to search for two existing patient accounts and link them.

## Phase 1: Appointment & Patient Management
### features
- [ ] **rec-dash-01**: Receptionist Dashboard (Stats: Today's Appointments, Pending Bills)
- [ ] **rec-appt-01**: Master Calendar View (All Doctors) - Filter by Doctor/Day
- [ ] **rec-appt-02**: Check-in functionality (Mark as "Arrived")
- [ ] **rec-appt-03**: Administrative Booking (Book/Cancel on behalf of patient)
- [ ] **rec-pat-01**: Patient Registration Form (Walk-in registration)
- [ ] **rec-pat-02**: Patient Directory (Search & Edit Profile)
- [ ] **rec-link-01**: Family Account Linking UI

## Phase 2: Billing & Cashier
### features
- [ ] **rec-bill-01**: Master Bill View (Aggregated costs from Doctor, Pharmacy, Lab)
- [ ] **rec-bill-02**: Payment Processing (Mark Bill as PAID)
- [ ] **rec-bill-03**: Invoice Generation (Printable View)

## Proposed Changes

### Database Schema
#### [NEW] [docs/schema/10_billing_updates.sql]
- Ensure `bills` table tracks payment status ('PENDING', 'PAID') and payment method.
- Ensure `family_links` table exists for linking accounts.

### Frontend Components (Receptionist)
#### [NEW] [src/app/(dashboard)/receptionist/page.tsx]
- Dashboard with stats and quick actions.

#### [NEW] [src/app/(dashboard)/receptionist/appointments/page.tsx]
- Calendar/List view of all appointments.
- "Check-in" button for today's appointments.

#### [NEW] [src/app/(dashboard)/receptionist/register/page.tsx]
- Form to create new patient accounts manually (bypassing public signup).

#### [NEW] [src/app/(dashboard)/receptionist/billing/page.tsx]
- List of pending bills.
- Detail view to see cost breakdown.
- "Review & Pay" action.

### Backend APIs
#### [NEW] [src/app/api/receptionist/appointments/route.ts]
- GET: Fetch all appointments with filters.
- PUT: Update status (Arrived, Cancelled).

#### [NEW] [src/app/api/receptionist/patients/route.ts]
- POST: Register new patient.
- GET: Search patients.

#### [NEW] [src/app/api/receptionist/billing/route.ts]
- GET: Fetch bills.
- POST: Process Payment (Update Bill + Appointment Status -> CLOSED).

## Verification Plan
### Automated Tests
- Test API endpoints for Role-Based Access Control (RBAC) - ensure only Receptionist can access.

### Manual Verification
1. **Walk-in Flow**: Register a new patient -> Book appointment -> Check them in.
2. **Billing Flow**:
   - Have a Doctor complete a consult.
   - Have Pharmacy dispense meds.
   - Go to Receptionist Billing -> Verify Total = Doc Fee + Meds.
   - Pay -> Verify Appointment is "CLOSED".
