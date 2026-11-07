-- "Get paid" setup: what a band needs before fans can pay it through Vipps,
-- and the platform's go-live approval (manual in beta).
-- Times are unix milliseconds.

-- 1. Organisation number, checked against Brønnøysund's open register.
ALTER TABLE bands ADD COLUMN org_number TEXT;          -- 9 digits
ALTER TABLE bands ADD COLUMN org_name TEXT;            -- name in Enhetsregisteret
ALTER TABLE bands ADD COLUMN org_form TEXT;            -- e.g. ENK, AS
ALTER TABLE bands ADD COLUMN org_owner_name TEXT;      -- innehaver / daglig leder, if listed
ALTER TABLE bands ADD COLUMN org_checked_at INTEGER;

-- 2. The business bank account Vipps pays out to (11 digits). Vipps checks
-- that it belongs to the organisation number.
ALTER TABLE bands ADD COLUMN payout_account TEXT;

-- 3. The prefilled Vipps product order (Management API) and its result.
ALTER TABLE bands ADD COLUMN vipps_order_id TEXT;
ALTER TABLE bands ADD COLUMN vipps_order_url TEXT;
ALTER TABLE bands ADD COLUMN vipps_order_status TEXT;  -- RECEIVED | MERCHANT_VIEWED | ORDER_SUBMITTED | COMPLETED | REJECTED | EXPIRED
ALTER TABLE bands ADD COLUMN vipps_order_created_at INTEGER;
ALTER TABLE bands ADD COLUMN vipps_order_checked_at INTEGER;
ALTER TABLE bands ADD COLUMN vipps_msn TEXT;           -- the band's own sales unit, once approved
CREATE UNIQUE INDEX bands_vipps_msn ON bands(vipps_msn);

-- 4. Go live: approved by a platform admin (logged in moderation_log).
ALTER TABLE bands ADD COLUMN live_approved_at INTEGER;
ALTER TABLE bands ADD COLUMN live_approved_by TEXT REFERENCES users(id);
