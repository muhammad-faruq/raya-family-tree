import Database from "better-sqlite3";
import path from "path";
import { SEED_PEOPLE } from "./seed-data";

const DB_PATH = path.join(process.cwd(), "family-tree.db");

let db: Database.Database | null = null;

function normaliseBirthday(raw: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";

  // If already ISO-like (YYYY-MM-DD), keep as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // Handle common numeric formats: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(value);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Handle year-only
  if (/^\d{4}$/.test(value)) {
    return `${value}-01-01`;
  }

  // Fallback: rely on JS Date parsing for things like "08 June 1972"
  const dt = new Date(value);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }

  // If we can't parse, leave as empty string to avoid bad data
  return "";
}

function migrateBirthdayFormat(database: Database.Database): void {
  try {
    const rows = database
      .prepare("SELECT id, birthday FROM people")
      .all() as Array<{ id: number; birthday: string }>;

    const update = database.prepare(
      "UPDATE people SET birthday = ? WHERE id = ?"
    );

    const transaction = database.transaction(() => {
      for (const row of rows) {
        const normalised = normaliseBirthday(row.birthday);
        if (normalised !== row.birthday) {
          update.run(normalised, row.id);
        }
      }
    });

    transaction();
  } catch {
    // If the table doesn't exist yet or another error occurs, ignore;
    // the initial seed will already use the current format.
  }
}

function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      birthday TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      spouses TEXT NOT NULL DEFAULT '[]',
      children TEXT NOT NULL DEFAULT '[]',
      parents TEXT NOT NULL DEFAULT '[]',
      generation INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Migrate: add generation column if missing (older DBs)
  const cols = db.prepare("PRAGMA table_info(people)").all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === "generation")) {
    db.exec("ALTER TABLE people ADD COLUMN generation INTEGER NOT NULL DEFAULT 0");
  }

  // Migrate: normalise birthday strings into a consistent YYYY-MM-DD format
  migrateBirthdayFormat(db);

  const { n } = db.prepare("SELECT COUNT(*) as n FROM people").get() as { n: number };
  if (n === 0) {
    const insert = db.prepare(`
      INSERT INTO people (id, first_name, last_name, birthday, avatar, gender, spouses, children, parents, generation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of SEED_PEOPLE) {
      const d = p.data;
      insert.run(
        p.id,
        (d["first name"] ?? "") as string,
        (d["last name"]  ?? "") as string,
        (d.birthday      ?? "") as string,
        (d.avatar        ?? "") as string,
        (d.gender        ?? "") as string,
        JSON.stringify(p.rels.spouses  ?? []),
        JSON.stringify(p.rels.children ?? []),
        JSON.stringify(p.rels.parents  ?? []),
        p.generation ?? 0
      );
    }
  }

  return db;
}

export interface PersonRow {
  id: number;
  first_name: string;
  last_name: string;
  birthday: string;
  avatar: string;
  gender: string;
  spouses: string;
  children: string;
  parents: string;
  generation: number;
}

export type FamilyDatum = {
  id: string;
  data: Record<string, unknown>;
  rels: { spouses: string[]; children: string[]; parents: string[] };
};

export function getFamilyData(): FamilyDatum[] {
  const rows = getDb().prepare("SELECT * FROM people ORDER BY id").all() as PersonRow[];
  return rows.map(row => ({
    id: String(row.id),
    data: {
      "first name": row.first_name,
      "last name":  row.last_name,
      birthday:     row.birthday,
      avatar:       row.avatar,
      gender:       row.gender as "M" | "F",
      generation:   row.generation,
    },
    rels: {
      spouses:  JSON.parse(row.spouses).map(String),
      children: JSON.parse(row.children).map(String),
      parents:  JSON.parse(row.parents).map(String),
    },
  }));
}

function isIntegerId(id: string): boolean {
  const n = parseInt(id, 10);
  return String(n) === id && n >= 0;
}

/**
 * Replaces all family data, auto-calculating generation for new people:
 *   - Has parents  → max(parent gen) + 1
 *   - Has children → min(child gen) - 1
 *   - Has spouse   → same as spouse
 *   - Fallback     → 0
 */
export function replaceFamilyData(data: FamilyDatum[]): void {
  const database = getDb();

  // 1. Normalise IDs (non-integer IDs get assigned fresh integers)
  const existingIds = new Set<number>();
  for (const p of data) {
    const n = parseInt(p.id, 10);
    if (String(n) === p.id && n >= 0) existingIds.add(n);
  }
  let nextId = existingIds.size > 0 ? Math.max(...existingIds) + 1 : 1;
  const idMap = new Map<string, string>();
  for (const p of data) {
    idMap.set(p.id, isIntegerId(p.id) ? p.id : String(nextId++));
  }
  const mapId  = (id: string)    => idMap.get(id) ?? id;
  const mapIds = (ids: string[]) => (ids ?? []).map(mapId).filter(Boolean);

  // 2. Seed generation from existing DB rows, then from data payload
  const existingGenMap = new Map<string, number>();
  try {
    for (const row of database.prepare("SELECT id, generation FROM people").all() as Array<{ id: number; generation: number }>) {
      existingGenMap.set(String(row.id), row.generation);
    }
  } catch { /* empty table is fine */ }

  const genMap = new Map<string, number>();
  for (const p of data) {
    const newId = mapId(p.id);
    const dataGen = p.data?.generation;
    if (typeof dataGen === "number") genMap.set(newId, dataGen);
    else if (existingGenMap.has(newId)) genMap.set(newId, existingGenMap.get(newId)!);
  }

  // 3. Propagate generations until stable
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of data) {
      const newId = mapId(p.id);
      if (genMap.has(newId)) continue;

      const parentGens = (p.rels.parents ?? []).map(id => genMap.get(mapId(id))).filter((g): g is number => g !== undefined);
      if (parentGens.length > 0) { genMap.set(newId, Math.max(...parentGens) + 1); changed = true; continue; }

      const childGens = (p.rels.children ?? []).map(id => genMap.get(mapId(id))).filter((g): g is number => g !== undefined);
      if (childGens.length > 0) { genMap.set(newId, Math.min(...childGens) - 1); changed = true; continue; }

      for (const sid of p.rels.spouses ?? []) {
        const sg = genMap.get(mapId(sid));
        if (sg !== undefined) { genMap.set(newId, sg); changed = true; break; }
      }
    }
  }
  for (const p of data) {
    const newId = mapId(p.id);
    if (!genMap.has(newId)) genMap.set(newId, 0);
  }

  // 4. Write
  const del    = database.prepare("DELETE FROM people");
  const insert = database.prepare(`
    INSERT INTO people (id, first_name, last_name, birthday, avatar, gender, spouses, children, parents, generation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  database.transaction(() => {
    del.run();
    for (const p of data) {
      const newId = mapId(p.id);
      const d = p.data ?? {};
      insert.run(
        parseInt(newId, 10),
        String(d["first name"] ?? ""),
        String(d["last name"]  ?? ""),
        String(d.birthday      ?? ""),
        String(d.avatar        ?? ""),
        String(d.gender        ?? ""),
        JSON.stringify(mapIds(p.rels?.spouses  ?? [])),
        JSON.stringify(mapIds(p.rels?.children ?? [])),
        JSON.stringify(mapIds(p.rels?.parents  ?? [])),
        genMap.get(newId) ?? 0
      );
    }
  })();
}
