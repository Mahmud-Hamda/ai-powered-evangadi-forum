-- Adds the PDF bytes so a host without a persistent disk can serve the file later.
ALTER TABLE `documents`
  ADD COLUMN `pdf_bytes` LONGBLOB NULL AFTER `byte_size`;
