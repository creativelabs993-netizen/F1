ALTER TABLE f1_last_lap_swings
  ADD COLUMN IF NOT EXISTS classification_text TEXT;
TRUNCATE TABLE f1_last_lap_swings;