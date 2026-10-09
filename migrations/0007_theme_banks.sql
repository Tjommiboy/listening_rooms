-- Four slots where a band can store its own room looks (colors, blends,
-- boxes, fonts, layout) and flick between them in the editor.
-- JSON array of 4 entries, each a theme object or null.
ALTER TABLE bands ADD COLUMN theme_banks TEXT;
