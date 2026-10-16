-- ============================================================
-- 22_access_control.sql : configurable permissions for staff
--
--   access_profiles        a named set of permissions. A role's default profile (system_role), a profile you create
--                          ("Pharmacist with billing"), or one person's own extra permissions (owner_user_id)
--   access_grants          the ticks: for each screen, which of view / add / change / approve are allowed
--   user_access_profiles   which profiles a person has (permissions add up)
--
-- Safe to run more than once. It only adds tables. Until a profile is edited, everyone keeps exactly the access their role
-- always had (the defaults live in the application), so running this changes nothing by itself.
-- ============================================================

CREATE TABLE IF NOT EXISTS `access_profiles` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `name`           VARCHAR(80)  NOT NULL,
  `description`    VARCHAR(255) NULL,
  `system_role`    VARCHAR(20)  NULL,     -- the role whose default profile this is (one per role)
  `owner_user_id`  INT NULL,              -- a person's own extra permissions (one per person)
  `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_profile_name` (`name`),
  UNIQUE KEY `uq_profile_role` (`system_role`),
  UNIQUE KEY `uq_profile_owner` (`owner_user_id`),
  FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `access_grants` (
  `profile_id`   INT NOT NULL,
  `resource`     VARCHAR(60) NOT NULL,
  `can_view`     TINYINT(1) NOT NULL DEFAULT 0,
  `can_add`      TINYINT(1) NOT NULL DEFAULT 0,
  `can_change`   TINYINT(1) NOT NULL DEFAULT 0,
  `can_approve`  TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`profile_id`, `resource`),
  FOREIGN KEY (`profile_id`) REFERENCES `access_profiles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_access_profiles` (
  `user_id`     INT NOT NULL,
  `profile_id`  INT NOT NULL,
  PRIMARY KEY (`user_id`, `profile_id`),
  KEY `idx_uap_profile` (`profile_id`),
  FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)           ON DELETE CASCADE,
  FOREIGN KEY (`profile_id`) REFERENCES `access_profiles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
