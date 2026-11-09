CREATE TABLE IF NOT EXISTS f1_last_lap_swings (
  race_key TEXT NOT NULL,
  driver_key TEXT NOT NULL,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_name TEXT NOT NULL,
  race_date DATE NOT NULL,
  start_lap INTEGER NOT NULL,
  start_position INTEGER NOT NULL,
  finish_position INTEGER NOT NULL,
  positions_gained INTEGER NOT NULL,
  driver_name TEXT NOT NULL,
  driver_code TEXT,
  constructor_id TEXT,
  constructor_name TEXT,
  status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (race_key, driver_key)
);
CREATE INDEX IF NOT EXISTS f1_last_lap_swings_season_idx
  ON f1_last_lap_swings (season, positions_gained DESC);
CREATE INDEX IF NOT EXISTS f1_last_lap_swings_driver_idx
  ON f1_last_lap_swings (driver_key, season);