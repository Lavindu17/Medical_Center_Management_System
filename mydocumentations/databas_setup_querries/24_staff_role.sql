-- ============================================================
-- 24_staff_role.sql : "Other staff", a role with no built-in duties
--
-- Some jobs do not fit a built-in role (a billing clerk, a pharmacy assistant who must not dispense). Give them the STAFF role:
-- it starts with only their own work and account pages, and everything else comes from the profiles you give them in the
-- Access control window. Nothing existing changes.
--
-- Safe to run more than once. Only adds a value to the users.role list.
-- ============================================================
SET @ddl = (SELECT IF(COLUMN_TYPE LIKE '%STAFF%', 'SELECT 1',
  'ALTER TABLE `users` MODIFY `role` ENUM(''PATIENT'',''DOCTOR'',''PHARMACIST'',''LAB_ASSISTANT'',''RECEPTIONIST'',''ADMIN'',''HR_MANAGER'',''STAFF'') NOT NULL')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
