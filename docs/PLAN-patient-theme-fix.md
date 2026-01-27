# PLAN-patient-theme-fix

## Goal
Standardize the Patient Module to use the "Green Healthcare Theme" (Emerald) across all pages, replacing the remaining blue styling.

## Context
- **User Request**: "patient dashboard is not fully implemented with the greenish theme"
- **Current State**: `layout.tsx` is updated, but inner pages (`page.tsx`, `book/page.tsx`, etc.) still use `blue-600`, `blue-50`, etc.
- **Target**: Unified Emerald theme consistent with Homepage and Pharmacist module.

## Affected Files
1. `src/app/(dashboard)/patient/page.tsx` (Dashboard)
   - Buttons, Cards, Text accents
2. `src/app/(dashboard)/patient/book/page.tsx` (Appointment Booking)
   - Progress steps, Doctor selection cards, Action buttons
3. `src/app/(dashboard)/patient/profile/page.tsx` (Profile)
   - Save buttons
4. `src/app/(dashboard)/patient/prescriptions/page.tsx` (Prescriptions)
   - Medicine headers

## Task Breakdown

### Phase 1: Dashboard Fixes (`patient/page.tsx`)
- [ ] Replace `bg-blue-600` buttons with `bg-emerald-600`
- [ ] Replace `blue-100` text with `emerald-100` (or appropriate contrast)
- [ ] Update "Upcoming/Completed" badges to Emerald
- [ ] Update "Queue" card styling (`border-blue-600` -> `border-emerald-600`)

### Phase 2: Booking Flow (`patient/book/page.tsx`)
- [ ] Update progress bar steps (`bg-blue-600` -> `bg-emerald-600`)
- [ ] Update selection highlights and hover states
- [ ] Update "Next/Confirm" buttons

### Phase 3: Profile & Prescriptions (`patient/profile/page.tsx`, `prescriptions/page.tsx`)
- [ ] Update primary action buttons (Save Changes)
- [ ] Update headers and accent text

## Verification Checklist
- [ ] **Dashboard**: Verify no blue elements remain in stats or action cards.
- [ ] **Booking**: Walk through booking flow, check step indicators and selection states.
- [ ] **Profile**: Verify "Save" button is green.
- [ ] **Prescriptions**: Verify headers are green.
