ALTER TABLE f1_last_lap_swings
  ADD COLUMN IF NOT EXISTS official_finish_position INTEGER;
TRUNCATE TABLE f1_last_lap_swings;