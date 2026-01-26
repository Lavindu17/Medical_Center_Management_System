# Doctor Module Overview

This document provides a detailed breakdown of the Doctor Module in the Medical Center Management System.

## 1. Dashboard
**Path:** `/doctor`  
**Purpose:** High-level overview of daily activities and performance.

### Features
- **Key Metrics:**
  - **Today's Appointments:** Count of active appointments for the current date.
  - **Upcoming Appointments:** Future scheduled visits.
  - **Total Patients:** Distinct count of patients treated.
  - **Revenue:** Projected revenue based on completed appointments x consultation fee.
- **Widgets (Planned/Placeholder):**
  - Revenue Chart (Visualizing income over time).
  - Recent Activity Stream.

## 2. Appointment Management
**Path:** `/doctor/appointments`  
**Purpose:** Manage patient queue and daily schedule.

### Features
- **Filtering:** "Today", "Week", "Month" views.
- **Search:** Real-time search by Patient Name or Date.
- **Queue Display:** Shows Token Number, Patient Details, Time Slot, and Status.
- **Status-Based Actions:**
  - `PENDING`: Waiting for patient arrival (Action disabled).
  - `CHECKED_IN`: Patient arrived (Start Consultation).
  - `ONGOING`: Consultation in progress (Resume).
  - `COMPLETED`: Visit finished (View Details).
  - `CANCELLED/ABSENT`: Visual indicator only.

## 3. Consultation Workspace
**Path:** `/doctor/consultation/[id]`  
**Purpose:** The core medical interface for conducting patient visits.

### Context Panel (Left)
- **Patient Info:** Demographics (Age, Gender), Reason for Visit.
- **Medical History:** Detailed background provided during registration.
- **Vitals Form:** 
  - Weight (kg), Temperature (°C), Blood Pressure (mmHg), Pulse (bpm).
  - Auto-saved with consultation.
- **Past Visits:** Quick list of previous diagnoses and dates.

### Clinical Workbench (Right)
- **Tabs:** "Current Consultation" vs "Full History" (Placeholder).
- **Clinical Notes:** Private textarea for diagnosis and observations.
- **Prescription System:**
  - **Medicine Search:** Dropdown with live stock levels.
  - **Dosing:** Dosage (e.g., 500mg), Frequency (e.g., 1-0-1), Duration (e.g., 3 days).
  - **Auto-Quantity:** Simple calculation support based on freq/duration.
  - **List Management:** Add/Remove items before finalizing.
- **Lab Requests:**
  - Selectable checklist of available lab tests with prices.
  - Multi-select capability.

### Actions
- **Save Draft:** Saves progress without closing the appointment (Status: `ONGOING`).
- **Complete:** Finalizes the visit (Status: `COMPLETED`).
  - **Auto-Billing:** Triggers generation of a bill including:
    - Doctor's Consultation Fee.
    - Standard Service Charge (500.00 LKR).
    - *Note: Pharmacy/Lab costs are added later by respective depts.*

## 4. Patient Directory
**Path:** `/doctor/patients`  
**Purpose:** Access to global patient records.

### Features
- **Global Search:** Find patients by Name or Phone.
- **List View:** Quick access to contact info and age/gender.
- **History Access:** Deep link to full patient history (Profile/Past Consultations).

## 5. Profile & Settings
**Path:** `/doctor/profile`  
**Purpose:** Manage personal account and availability logic.

### Tabs
1.  **General Info:**
    - Edit Name, Phone.
    - Set **Consultation Fee**.
    - Update License Number.
    - View assigned Specialization.
2.  **Schedule & Availability:**
    - **Hours:** Set Start Time & End Time.
    - **Slot Duration:** Configurable (15, 20, 30, 45, 60 mins).
    - **Working Days:** Toggle days of the week (Mon-Sun).
3.  **Blocked Dates (Leave Management):**
    - Block specific calendar dates for leave/holidays.
    - Reason logging (e.g., "Vacation").
    - Prevents booking during these times.

## Technical Implementation
- **Authentication:** Role-based protection (`DOCTOR` role required).
- **Database:**
  - Uses `doctors` table extending `users` for specific settings.
  - Transactions used for Consultation Save to ensure data integrity across `appointments`, `prescriptions`, `lab_requests`, and `bills`.
- **API Routes:**
  - `/api/doctor/stats`: Dashboard metrics.
  - `/api/doctor/profile`: Schedule/Profile updates.
  - `/api/doctor/consultation`: CRUD operation for visits.
