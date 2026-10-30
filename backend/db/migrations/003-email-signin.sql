-- Lets an account use an email code as the sign-in method chosen at registration.
--   mysql -u <user> -p <database> < db/migrations/003-email-signin.sql

ALTER TABLE `users`
  ADD COLUMN `email_signin` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password_hash`;
