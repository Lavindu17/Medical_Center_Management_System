-- ============================================================
-- 23_access_seed.sql : each role's starting permissions, written into the database
--
-- Access is decided only by what is stored in access_profiles / access_grants (see 22_access_control.sql): with nothing
-- stored, no member of staff can open anything. This file stores the starting point for every role, which is what each
-- role could always do. Edit them afterwards in the Access control window (Profiles and roles).
--
-- Safe to run more than once: it only adds rows that are missing and never changes ones you edited.
-- GENERATED from src/lib/access/defaults.ts by a test; change the defaults there, not here.
-- ============================================================

INSERT IGNORE INTO `access_profiles` (`name`, `system_role`) VALUES ('Role: DOCTOR', 'DOCTOR');
INSERT IGNORE INTO `access_grants` (`profile_id`, `resource`, `can_view`, `can_add`, `can_change`, `can_approve`)
SELECT p.`id`, v.`resource`, v.`can_view`, v.`can_add`, v.`can_change`, v.`can_approve` FROM `access_profiles` p JOIN (
        SELECT 'reception.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.appointments' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.dashboard' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'consultations' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 1 AS `can_approve`
  UNION ALL SELECT 'doctor.patients' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.earnings' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.profile' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dispensing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.inventory' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.alerts' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.requests' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.tests' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'billing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.overview' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.roster' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.attendance' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.leave' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.employees' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.settings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.revenue' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.users' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.doctors' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.audit' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'access.config' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.work' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.account' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
) v WHERE p.`system_role` = 'DOCTOR';

INSERT IGNORE INTO `access_profiles` (`name`, `system_role`) VALUES ('Role: PHARMACIST', 'PHARMACIST');
INSERT IGNORE INTO `access_grants` (`profile_id`, `resource`, `can_view`, `can_add`, `can_change`, `can_approve`)
SELECT p.`id`, v.`resource`, v.`can_view`, v.`can_add`, v.`can_change`, v.`can_approve` FROM `access_profiles` p JOIN (
        SELECT 'reception.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.appointments' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'consultations' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.earnings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.profile' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dashboard' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dispensing' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 1 AS `can_approve`
  UNION ALL SELECT 'pharmacy.inventory' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.alerts' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.requests' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.tests' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'billing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.overview' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.roster' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.attendance' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.leave' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.employees' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.settings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.revenue' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.users' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.doctors' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.audit' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'access.config' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.work' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.account' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
) v WHERE p.`system_role` = 'PHARMACIST';

INSERT IGNORE INTO `access_profiles` (`name`, `system_role`) VALUES ('Role: LAB_ASSISTANT', 'LAB_ASSISTANT');
INSERT IGNORE INTO `access_grants` (`profile_id`, `resource`, `can_view`, `can_add`, `can_change`, `can_approve`)
SELECT p.`id`, v.`resource`, v.`can_view`, v.`can_add`, v.`can_change`, v.`can_approve` FROM `access_profiles` p JOIN (
        SELECT 'reception.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.appointments' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'consultations' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.earnings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.profile' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dispensing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.inventory' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.alerts' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.dashboard' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.requests' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.tests' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'billing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.overview' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.roster' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.attendance' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.leave' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.employees' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.settings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.revenue' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.users' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.doctors' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.audit' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'access.config' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.work' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.account' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
) v WHERE p.`system_role` = 'LAB_ASSISTANT';

INSERT IGNORE INTO `access_profiles` (`name`, `system_role`) VALUES ('Role: RECEPTIONIST', 'RECEPTIONIST');
INSERT IGNORE INTO `access_grants` (`profile_id`, `resource`, `can_view`, `can_add`, `can_change`, `can_approve`)
SELECT p.`id`, v.`resource`, v.`can_view`, v.`can_add`, v.`can_change`, v.`can_approve` FROM `access_profiles` p JOIN (
        SELECT 'reception.dashboard' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.appointments' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.patients' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'consultations' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.earnings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.profile' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dispensing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.inventory' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.alerts' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.requests' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.tests' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'billing' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 1 AS `can_approve`
  UNION ALL SELECT 'hr.overview' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.roster' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.attendance' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.leave' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.employees' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.settings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.revenue' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.users' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.doctors' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.audit' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'access.config' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.work' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.account' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
) v WHERE p.`system_role` = 'RECEPTIONIST';

INSERT IGNORE INTO `access_profiles` (`name`, `system_role`) VALUES ('Role: HR_MANAGER', 'HR_MANAGER');
INSERT IGNORE INTO `access_grants` (`profile_id`, `resource`, `can_view`, `can_add`, `can_change`, `can_approve`)
SELECT p.`id`, v.`resource`, v.`can_view`, v.`can_add`, v.`can_change`, v.`can_approve` FROM `access_profiles` p JOIN (
        SELECT 'reception.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.appointments' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'consultations' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.earnings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.profile' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dispensing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.inventory' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.alerts' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.requests' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.tests' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'billing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.overview' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.roster' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.attendance' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 1 AS `can_approve`
  UNION ALL SELECT 'hr.leave' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 1 AS `can_approve`
  UNION ALL SELECT 'hr.employees' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.settings' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.revenue' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.users' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.doctors' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.audit' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'access.config' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.work' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.account' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
) v WHERE p.`system_role` = 'HR_MANAGER';

INSERT IGNORE INTO `access_profiles` (`name`, `system_role`) VALUES ('Role: ADMIN', 'ADMIN');
INSERT IGNORE INTO `access_grants` (`profile_id`, `resource`, `can_view`, `can_add`, `can_change`, `can_approve`)
SELECT p.`id`, v.`resource`, v.`can_view`, v.`can_add`, v.`can_change`, v.`can_approve` FROM `access_profiles` p JOIN (
        SELECT 'reception.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.appointments' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.patients' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'consultations' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.earnings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.profile' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dispensing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.inventory' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.alerts' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.requests' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.tests' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'billing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.overview' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.roster' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.attendance' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 1 AS `can_approve`
  UNION ALL SELECT 'hr.leave' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 1 AS `can_approve`
  UNION ALL SELECT 'hr.employees' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.settings' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.dashboard' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.revenue' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.users' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.doctors' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.audit' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 1 AS `can_approve`
  UNION ALL SELECT 'access.config' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.work' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.account' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
) v WHERE p.`system_role` = 'ADMIN';

INSERT IGNORE INTO `access_profiles` (`name`, `system_role`) VALUES ('Role: STAFF', 'STAFF');
INSERT IGNORE INTO `access_grants` (`profile_id`, `resource`, `can_view`, `can_add`, `can_change`, `can_approve`)
SELECT p.`id`, v.`resource`, v.`can_view`, v.`can_add`, v.`can_change`, v.`can_approve` FROM `access_profiles` p JOIN (
        SELECT 'reception.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.appointments' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'reception.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'consultations' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.patients' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.earnings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'doctor.profile' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.dispensing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.inventory' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'pharmacy.alerts' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.requests' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'lab.tests' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'billing' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.overview' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.roster' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.attendance' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.leave' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.employees' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'hr.settings' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.dashboard' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.revenue' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.users' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.doctors' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'admin.audit' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'access.config' AS `resource`, 0 AS `can_view`, 0 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.work' AS `resource`, 1 AS `can_view`, 1 AS `can_add`, 0 AS `can_change`, 0 AS `can_approve`
  UNION ALL SELECT 'my.account' AS `resource`, 1 AS `can_view`, 0 AS `can_add`, 1 AS `can_change`, 0 AS `can_approve`
) v WHERE p.`system_role` = 'STAFF';
