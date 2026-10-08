-- MySpace-style room customization. All optional; NULL means "use the default".
ALTER TABLE bands ADD COLUMN tagline TEXT;          -- short line under the band name
ALTER TABLE bands ADD COLUMN bio TEXT;              -- plain text, line breaks kept
ALTER TABLE bands ADD COLUMN theme TEXT;            -- JSON, see lib/room-theme.ts
ALTER TABLE bands ADD COLUMN links TEXT;            -- JSON: [{ "label", "url" }]
ALTER TABLE bands ADD COLUMN avatar_key TEXT;       -- image in the band's bucket
ALTER TABLE bands ADD COLUMN background_key TEXT;   -- image in the band's bucket
ALTER TABLE bands ADD COLUMN profile_updated_at INTEGER;
