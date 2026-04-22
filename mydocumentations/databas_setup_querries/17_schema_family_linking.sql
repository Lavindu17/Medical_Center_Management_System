-- 17_schema_family_linking.sql
-- Table to store family relationships between patients

DROP TABLE IF EXISTS `patient_family_links`;

CREATE TABLE `patient_family_links` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `requester_id` INT NOT NULL, -- The patient initiating the link (User ID)
  `member_id` INT NOT NULL,    -- The family member account being linked (User ID)
  `relationship` ENUM('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER') NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys linking to users table
  FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  
  -- Prevent duplicate links and self-linking
  UNIQUE KEY `unique_family_link` (`requester_id`, `member_id`),
  CONSTRAINT `chk_no_self_link` CHECK (`requester_id` <> `member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
