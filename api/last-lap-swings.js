import { db } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

const API = 'https://api.jolpi.ca/ergast/f1/';
const validPosition = value => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function fetchJsonWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      if (response.status !== 429 && response.status < 500) throw new Error('Official results feed returned HTTP ' + response.status);
      lastError = new Error('Official results feed returned HTTP ' + response.status);
    } catch (error) { lastError = error; }
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw lastError || new Error('Official results feed unavailable');
}

async function fetchSeasonResults(year) {
  const merged = new Map();
  let offset = 0;
  let total = Infinity;
  const limit = 100;
  while (offset < total && offset < 2000) {
    const json = await fetchJsonWithRetry(API + year + '/results/?limit=' + limit + '&offset=' + offset);
    await new Promise(resolve => setTimeout(resolve, 150));
    const mr = json?.MRData || {};
    const races = mr.RaceTable?.Races || [];
    total = Number(mr.total || 0);
    if (!races.length) break;
    for (const race of races) {
      const round = Number(race.round);
      const key = year + '-' + round;
      if (!merged.has(key)) merged.set(key, {
        race_key: key, season: Number(year), round,
        race_name: race.raceName || 'Grand Prix', race_date: race.date,
        results: []
      });
      merged.get(key).results.push(...(race.Results || []));
    }
    offset += limit;
    if (!total) break;
  }
  return [...merged.values()];
}

export default async function(req, res) {
  try {
    const year = String(req.query.year || new Date().getUTCFullYear());
    const seasonNumber = Number(year);
    const currentYear = new Date().getUTCFullYear();
    if (!/^\d{4}$/.test(year) || !Number.isInteger(seasonNumber) || seasonNumber < 1950 || seasonNumber > currentYear) {
      return res.status(400).json({ ok: false, error: 'Choose a season from 1950 to ' + currentYear + '.' });
    }
    if (req.query.refresh !== '1') {
      const cached = await db.query(
        'SELECT * FROM f1_last_lap_swings WHERE season = $1 ORDER BY positions_gained DESC, race_date DESC, finish_position',
        [Number(year)]
      );
      if (cached.rows?.length) {
        return res.json({ ok: true, year: Number(year), records: cached.rows, cached: true,
          source: 'Jolpica-F1 official race classifications', coverage: '1950 onward',
          methodology: 'Official starting grid compared with final official race classification.' });
      }
    }

    const races = await fetchSeasonResults(year);
    const today = new Date().toISOString().slice(0, 10);
    const records = [];
    for (const race of races) {
      if (!race.race_date || race.race_date > today) continue;
      // Indianapolis 500 counted toward the early World Championship but is not a Grand Prix.
      if (/^Indianapolis 500$/i.test(race.race_name || '')) continue;
      for (const result of race.results) {
        const driver = result.Driver || {};
        const team = result.Constructor || {};
        const grid = validPosition(result.grid);
        const finalPosition = validPosition(result.position);
        if (!driver.driverId || !grid || !finalPosition) continue;
        records.push({
          race_key: race.race_key, driver_key: driver.driverId,
          season: Number(year), round: race.round, race_name: race.race_name,
          race_date: race.race_date, start_lap: 0,
          start_position: grid, finish_position: finalPosition,
          official_finish_position: finalPosition,
          classification_text: String(result.positionText || result.position || finalPosition),
          positions_gained: grid - finalPosition,
          driver_name: [driver.givenName, driver.familyName].filter(Boolean).join(' ') || driver.driverId,
          driver_code: driver.code || null, constructor_id: team.constructorId || null,
          constructor_name: team.name || null, status: result.status || null
        });
      }
    }

    // Older seasons can contain shared-drive or duplicate driver entries; keep one official result per driver per Grand Prix.
    const uniqueRecords = new Map();
    for (const record of records) {
      const key = record.race_key + ':' + record.driver_key;
      const previous = uniqueRecords.get(key);
      if (!previous || record.finish_position < previous.finish_position) uniqueRecords.set(key, record);
    }
    const dedupedRecords = [...uniqueRecords.values()];

    for (let i = 0; i < dedupedRecords.length; i += 100) {
      const batch = dedupedRecords.slice(i, i + 100);
      await db.query(
        `INSERT INTO f1_last_lap_swings
          (race_key, driver_key, season, round, race_name, race_date, start_lap,
           start_position, finish_position, official_finish_position, classification_text,
           positions_gained, driver_name, driver_code, constructor_id, constructor_name, status, updated_at)
         SELECT x.race_key, x.driver_key, x.season, x.round, x.race_name, x.race_date::date,
                x.start_lap, x.start_position, x.finish_position, x.official_finish_position,
                x.classification_text, x.positions_gained, x.driver_name, x.driver_code,
                x.constructor_id, x.constructor_name, x.status, now()
         FROM jsonb_to_recordset($1::jsonb) AS x(
           race_key text, driver_key text, season int, round int, race_name text, race_date text,
           start_lap int, start_position int, finish_position int, official_finish_position int,
           classification_text text, positions_gained int, driver_name text, driver_code text,
           constructor_id text, constructor_name text, status text
         )
         ON CONFLICT (race_key, driver_key) DO UPDATE SET
           start_position=EXCLUDED.start_position, finish_position=EXCLUDED.finish_position,
           official_finish_position=EXCLUDED.official_finish_position,
           classification_text=EXCLUDED.classification_text, positions_gained=EXCLUDED.positions_gained,
           driver_name=EXCLUDED.driver_name, driver_code=EXCLUDED.driver_code,
           constructor_id=EXCLUDED.constructor_id, constructor_name=EXCLUDED.constructor_name,
           status=EXCLUDED.status, updated_at=now()`,
        [JSON.stringify(batch)]
      );
    }
    const saved = await db.query(
      'SELECT * FROM f1_last_lap_swings WHERE season = $1 ORDER BY positions_gained DESC, race_date DESC, finish_position',
      [Number(year)]
    );
    return res.json({
      ok: true, year: Number(year), records: saved.rows || [], cached: false,
      races_available: races.length,
      races_with_data: new Set(dedupedRecords.map(r => r.race_key)).size,
      imported_rows: dedupedRecords.length,
      source: 'Jolpica-F1 official race classifications',
      coverage: '1950 onward',
      methodology: 'Official starting grid position compared with final official race classification; no lap timing used. Pit-lane/no-grid starters are excluded. Historical shared-drive duplicates are consolidated to one driver result per Grand Prix.'
    });
  } catch (error) {
    console.error('grid-to-finish analysis failed', String(error));
    return res.status(502).json({ ok: false, error: 'Could not load official grid-to-finish results.', detail: String(error) });
  }
}