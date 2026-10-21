-- Stripe for fans and bands outside Norway (Vipps stays for Norway).

-- Which payment service an agreement runs on. For Stripe, agreements.id is
-- the Stripe subscription id. The daily charge job only handles Vipps:
-- Stripe renews subscriptions by itself and tells us through webhooks.
ALTER TABLE agreements ADD COLUMN provider TEXT NOT NULL DEFAULT 'vipps'
  CHECK (provider IN ('vipps', 'stripe'));
-- The band's connected account a Stripe fan subscription lives on (NULL for
-- Vipps and for band plans, which are on our own Stripe account).
ALTER TABLE agreements ADD COLUMN stripe_account TEXT;

-- Each band can connect its own Stripe account to sell to fans abroad.
ALTER TABLE bands ADD COLUMN stripe_account_id TEXT;
ALTER TABLE bands ADD COLUMN stripe_charges_enabled INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX bands_stripe ON bands(stripe_account_id);

-- One-time sign-in links sent by email (people without Vipps).
-- users.vipps_sub holds "email:<address>" for these accounts.
CREATE TABLE login_tokens (
  token_hash  TEXT PRIMARY KEY,   -- sha256 of the token in the link
  email       TEXT NOT NULL,
  next        TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);
CREATE INDEX login_tokens_email ON login_tokens(email, expires_at);

-- Stripe webhook events already handled (Stripe may deliver twice).
CREATE TABLE stripe_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  received_at  INTEGER NOT NULL
);
