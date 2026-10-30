-- Adds the password reset table to an existing database.
-- Running schema.sql instead would drop every table, so apply this file when
-- you already have data:
--   mysql -u <user> -p <database> < db/migrations/001-password-resets.sql

CREATE TABLE IF NOT EXISTS `password_resets` (
    `reset_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `token_hash` CHAR(64) NOT NULL UNIQUE,
    `expires_at` DATETIME NOT NULL,
    `used_at` DATETIME NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,

    INDEX `idx_password_resets_user_id` (`user_id`),
    INDEX `idx_password_resets_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
