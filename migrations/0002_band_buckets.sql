-- Each band gets its own private R2 bucket, created automatically when the
-- band is set up. NULL until creation succeeds (it is retried on first upload).
ALTER TABLE bands ADD COLUMN bucket_name TEXT;
CREATE UNIQUE INDEX bands_bucket ON bands(bucket_name);
