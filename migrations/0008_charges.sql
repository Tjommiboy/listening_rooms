-- Monthly charges. Vipps Recurring never charges by itself: our daily job
-- (POST /api/cron/charges, run by the Worker's cron trigger) creates the next
-- month's charge for each active agreement. One row per agreement and period,
-- so running the job twice can never charge twice.
CREATE TABLE charges (
  id            TEXT PRIMARY KEY,          -- our id; also the Vipps idempotency key
  vipps_id      TEXT UNIQUE,               -- Vipps chargeId once created
  agreement_id  TEXT NOT NULL REFERENCES agreements(id),
  period_start  INTEGER NOT NULL,          -- the paid_until this charge renews from
  due           TEXT NOT NULL,             -- YYYY-MM-DD (Oslo date)
  amount_ore    INTEGER NOT NULL,
  status        TEXT NOT NULL,             -- CREATING | PENDING | CAPTURED | FAILED | CANCELLED
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE (agreement_id, period_start)
);
CREATE INDEX charges_agreement ON charges(agreement_id, status);
