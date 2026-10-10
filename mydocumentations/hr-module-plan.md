# HR module: research and MVP plan

**Status: built (2026-10-10).** Decisions taken: HR approves leave (not line managers); doctors are included; a shift is just a date with a start and finish time, several per person per day, chosen for one or many people at once (presets are only quick-fill buttons); anyone can clock in at any time and the result is flagged early, late or unscheduled; a weekly day off is simply "no shift"; administrators see the HR portal too; leave defaults (annual 14, casual 7, unpaid unlimited) are editable placeholders to confirm against the Act.

**How to turn it on:** run `databas_setup_querries/20_hr.sql` (idempotent), create an HR manager under Admin, User Management, and sign in. Everyone on staff then has **My Work** in their menu; the HR portal is at `/hr`.

**Behaviour worth knowing**
- Clocking in after a shift has finished is not "late" for that shift; it matches the next shift (flagged early) or is unscheduled.
- A leave request cannot span two calendar years (submit one per year), and a half day applies to a single day.
- Leave days exclude public holidays and, in a week that has a roster for that person, the days with no shift. HR can change the days charged when approving.
- Approving a doctor's full-day leave closes those days for patient bookings and tells patients with bookings to rebook; cancelling the leave re-opens them.
- Nobody can decide their own leave or correction, and nobody can edit their own attendance. Every HR change, and every time HR opens someone's attendance, is in the audit trail.

Scope you gave: shifts defined per employee, employees mark in and out, request leave and see their own HR history on a dashboard, and HR sees all employees' attendance and history. Notifications stay in-app. Payments and payroll are out of scope.

## 1. What other HR systems treat as essential

Most sources are vendor pages, so this is a list of what vendors converge on, not independent evidence. The one hard-law section (Sri Lanka) is flagged where the sources disagree.

**Employee self-service (ESS) is the front door.** A dashboard of leave balances, upcoming shifts and recent attendance, with leave requests and (usually) mobile access. ([Hono HRMS guide](https://www.hono.ai/blog/hrms-software-modules-and-features), [Prism ERP attendance and leave](https://docs.prismerp.net/human-capital/attendance-leave/))

**Time and attendance.** Clock in and out, a timesheet, working hours, overtime and attendance status. Commercial suites add location zones, selfies or biometrics, but sources treat those as later additions. ([Sage HR scheduling](https://www.sage.com/en-us/sage-business-cloud/hr/features/scheduling/))

- Late arrival uses a short **grace window** (commonly 5 to 15 minutes), used for scoring while pay follows actual times. Repeated lateness is a separate rule (for example three late days in a month count as a half-day). ([FactoHR attendance policy](https://factohr.com/policy/attendance-policy-for-employees/), [Zoho People grace periods](https://help.zoho.com/portal/en/kb/people/administrator-guide/attendance-management/settings/articles/specific-policies))
- **Missed clock-out and corrections** ("regularisation") go through a request with approval, and every edit is logged. ([FactoHR late-coming policy](https://factohr.com/policy/late-coming-policy-for-employees/), [timesheets.com security](https://www.timesheets.com/time-tracking-security))
- Anti-fraud controls in the sources: location checks, IP limits, biometrics, alerts for repeated punches from one address. The sources also note these have privacy and spoofing limits; layering them with an audit trail works better than relying on one. ([Workstatus geofencing](https://workstatus.io/?p=4905))

**Shift scheduling.** A roster showing every employee's shifts, kept in step with approved leave so people on leave are not scheduled by accident. Hospitals add rotation, on-call, open-shift offers and **shift swaps with approval**. ([Workforce.com hospital scheduling](https://workforce.com/industry/hospitals/scheduling), [Shifton healthcare scheduling](https://shifton.com/blog/best-healthcare-staff-scheduling-software/))

**Leave management.** Request, approve, deduct from a balance, report. The rules vendors configure ([Zoho leave policy](https://www.zoho.com/people/help/adminguide/newleavepolicy.html), [PeopleForce](https://help.peopleforce.io/en/articles/6668070-leave-policies), [Kredily](https://kredily.com/support/leave/configure-leave-rules.html)):

- leave **types** with a yearly allowance, paid or unpaid; half-day switched on per type
- **accrual** (monthly or yearly), pro-rata for people who join mid-year, balance caps, carry-forward and encashment
- **no negative balances** by default (a setting can allow it)
- **overlap check** on create and edit: only pending or approved requests block; a morning half-day and an afternoon half-day may share a date
- **public holidays** are not counted as leave days; some systems also count weekends or holidays that fall between leave days
- approval routing by length (a day to the manager, weeks to HR) and a response-time target
- before approving, managers check holidays, **team overlap**, and attendance already recorded

## 2. Sri Lanka rules (needs confirming, so none of it is hard-coded)

The law-firm summaries agree on the shape and disagree on some numbers, so these are **placeholders you must confirm** with the Act and any applicable Wages Board order. ([Conventus Law](https://conventuslaw.com/report/holiday-entitlements-under-the-sri-lankan-labour/), [Rivermate](https://www.rivermate.com/guides/sri-lanka/leave), [WageIndicator](https://wageindicator.org/en-lk/work-in-sri-lanka/labour-law/compensation-and-working-time), [TimeCamp overtime](https://timecamp.com/countries-overtime-law/sri-lanka))

| Topic | What the sources say | Confidence |
|---|---|---|
| Applies to | Shop and Office Employees Act (No. 19 of 1954); trades under a Wages Board follow that board instead | Medium |
| Annual leave | 14 days after a year, pro-rated in the first year | Medium |
| Casual leave | 7 days a year (half a day per completed month in the first year), also covering illness | High |
| Sick leave | Sources **conflict** (14 days with a medical certificate, or none beyond casual leave) | **Low** |
| Hours | 8 a day, 45 a week for the Act; a Wages Board may say 48 | Medium |
| Overtime | 1.5 times the ordinary rate, 12 hours a week cap (not strictly enforced) | Medium |

**Design consequence:** leave types, yearly allowances, standard hours and holidays are **settings HR edits**, shipped with sensible defaults and a visible note saying "confirm against the Act". Overtime is **recorded for reporting only**; paying it (and EPF/ETF, payslips) is payroll, which is out of scope.

## 3. What we already have that this builds on

- Six fixed roles, enforced by route prefix in `middleware.ts` and `requireRole(...)` in the API. There is **no HR role**, and the `users.role` column is a database enum.
- Each role has its own layout and navigation; shared screens are thin per-role wrappers around one shared component (the Account page pattern).
- `doctor_leaves` (a day a doctor cannot be booked) and `doctor_schedules`: **these are about patient appointments, not HR**. They stay as they are; an approved HR leave for a doctor will write into `doctor_leaves`.
- In-app notifications, the audit trail and the mobile-first shell are all reusable.

## 4. Proposed MVP

### Who uses it

| Person | Gets |
|---|---|
| **Every staff member** (doctor, pharmacist, lab, reception, admin, HR) | **My Work**: today's shift and clock in/out, my shifts, my leave, my attendance history |
| **HR manager** (new role `HR_MANAGER`) | An **HR portal**: overview, employees, roster, attendance, leave inbox, settings |
| **Admin** | Same HR portal access (a superset), so a small clinic without a dedicated HR person still works |
| **Patients** | Nothing |

### Screens

**My Work** (one page, tabs on a phone, a dashboard on desktop)
- **Today:** a big **Clock in** / **Clock out** button, the assigned shift, time worked so far, and a clear note if you are early, late or have no shift today.
- **Summary for the month:** days present, late days, hours worked, extra hours; leave balances by type.
- **My shifts:** the next two weeks.
- **Leave:** request (type, dates, full or half day, reason), live balance after the request, status of past requests, cancel while pending.
- **History:** attendance by month with status per day (present, late, absent, on leave, holiday, day off, **missing clock-out**), and a "fix this day" correction request.

**HR portal**
- **Overview:** today's counts (in now, late, absent, on leave), pending requests, missing clock-outs.
- **Employees:** a list with employee number, department, designation, join date, status; one page per employee with profile, balances, attendance and leave history.
- **Roster:** week grid (employees by days). Assign a shift to one cell, to a whole week, or copy last week. Leave and holidays are shown in the grid and **assigning over approved leave is blocked**.
- **Attendance:** by day or date range, filter by employee and department, with status, hours and late or early marks. Export to CSV. HR can fix or add a record (logged with a reason).
- **Leave inbox:** approve or reject with a note. Each request shows the balance, who else is off those days, and (for doctors) how many booked appointments are affected. **A calendar** of who is off.
- **Settings:** shift templates, leave types and allowances, public holidays, grace minutes, standard hours.

### Rules (defaults, all adjustable in settings)

- **Server time only.** The clock-in time is the server's, never the browser's. IP and device are recorded.
- **One open session at a time;** no double clock-in. Clocking out closes it.
- **Late** = more than the grace minutes (default 10) after the shift start. **Early leave** is flagged the same way. Neither changes pay in this MVP.
- **Overnight shifts:** a shift that crosses midnight belongs to the day it started.
- **No shift today:** the person can still clock in; it shows as **unscheduled** so HR can see it.
- **Missing clock-out:** an open session older than 16 hours is shown as incomplete and cannot block the next day; the employee or HR files a correction.
- **Corrections** need HR approval, state a reason, and keep the original punch.
- **Absent** = a shift was assigned, no leave covers it, no holiday, and no punch.
- **Leave:** half-day allowed per type; days exclude public holidays; no overlap with a pending or approved request (same half or full day); cannot exceed the balance unless the type allows it; HR **cannot approve their own request** (another HR person or an admin does).
- **Everything HR changes, and every time HR opens an employee's records, is written to the audit trail.**

### Integration with the rest of the system

- Approving a **doctor's** leave also writes `doctor_leaves` rows, so patients cannot book that day, and affected patients get the existing in-app notice.
- In-app notifications: new leave request to HR; decision to the employee; correction requests and decisions; a shift assigned or changed.
- Approved leave shows in the roster, so shifts are not scheduled over it.

### Data model (new tables, all additive, in `20_hr.sql`)

`employee_profiles` (user, employee number, department, designation, join date, status) · `shift_templates` · `shift_assignments` (user, date, template; one per person per day) · `attendance_records` (user, work date, clock in, clock out, source, late and early minutes, worked minutes, IP) · `attendance_corrections` · `leave_types` · `leave_entitlements` (user, type, year, days; defaults from the type) · `leave_requests` · `public_holidays` · `hr_settings`. The `users.role` enum gains `HR_MANAGER`.

## 5. Delivery plan

Each phase is shippable and ends green on tests.

| Phase | Delivers | Main risk |
|---|---|---|
| **0. Foundations** | `HR_MANAGER` role everywhere (login redirect, middleware, user admin), HR portal shell, **My Work** entry in every staff nav, migration, employee profiles, settings | Adding a role touches login, middleware, the role list and tests; I'd verify every existing role behaves the same |
| **1. Shifts** | Shift templates, roster grid, single and bulk assign, copy week, "my shifts" | Grid usability on a phone: roster editing is desktop-first, viewing is mobile-first |
| **2. Attendance** | Clock in/out, status rules, history, HR view and CSV export, corrections | Midnight and time-zone edge cases, so these get unit tests first |
| **3. Leave** | Types, balances, request, overlap and holiday rules, HR inbox, calendar, doctor-leave integration | Day-counting rules (half days, holidays) are the classic source of wrong balances |
| **4. Dashboards and reports** | Employee dashboard, HR overview, monthly attendance and leave report, notifications, audit coverage, accessibility and mobile pass | Mostly polish |

**Tests**, as for the audit trail: unit tests for lateness, day counting, overlap and overnight logic; integration tests that an employee **cannot see another employee's data**, HR can, self-approval is refused, double clock-in is refused, balances never go negative, approved doctor leave blocks bookings, and each HR action is audited; plus a phone-size and accessibility check of every new screen.

## 6. Deliberately left out of the MVP

Payroll, payslips, EPF/ETF and overtime pay · location zones, selfie or biometric capture · shift swaps, open-shift offers and rotation patterns · monthly accrual, carry-forward and encashment · multi-level or line-manager approval · attachments (medical certificates) · recruitment, performance and expense claims · email and SMS reminders.

Each of these is a clean addition later; none changes the tables above.

## 7. Decisions I need from you

1. **Who approves leave:** HR only (my recommendation for an MVP), or also a line manager?
2. **Doctors:** include them in HR shifts and attendance? (Recommended yes. Their patient-booking schedule stays separate.)
3. **One shift per person per day,** or allow split shifts (for example morning and evening)? Recommended one for the MVP.
4. **Clock-in rule:** anyone can clock in any time (flagged as unscheduled or early), or only within a window around their shift? Recommended any time with flags.
5. **Default leave numbers** (annual 14, casual 7, sick 0 or 14?): shall I ship these as editable defaults, with a note that you confirm them against the Act?
6. **Weekly day off:** treated as simply "no shift assigned", with no separate weekend setting. Is that acceptable?
7. **Admin and HR:** should an admin see the HR portal too?
