import Database from "better-sqlite3";
import path from "path";
import { SEED_PEOPLE } from "./seed-data";

const DB_PATH = path.join(process.cwd(), "family-tree.db");

let db: Database.Database | null = null;

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

  // Migrate existing database: add generation column if it doesn't exist yet
  const cols = db.prepare("PRAGMA table_info(people)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "generation")) {
    db.exec("ALTER TABLE people ADD COLUMN generation INTEGER NOT NULL DEFAULT 0");
  }

  const count = db.prepare("SELECT COUNT(*) as n FROM people").get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare(`
      INSERT INTO people (id, first_name, last_name, birthday, avatar, gender, spouses, children, parents, generation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of SEED_PEOPLE) {
      const d = p.data;
      insert.run(
        p.id,
        (d["first name"] ?? "") as string,
        (d["last name"] ?? "") as string,
        (d.birthday ?? "") as string,
        (d.avatar ?? "") as string,
        (d.gender ?? "") as string,
        JSON.stringify(p.rels.spouses ?? []),
        JSON.stringify(p.rels.children ?? []),
        JSON.stringify(p.rels.parents ?? []),
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

/**
 * Returns family data in the format expected by family-chart.
 * generation is included in the data payload so the frontend can use it.
 */
export function getFamilyData(): FamilyDatum[] {
  const database = getDb();
  const rows = database.prepare("SELECT * FROM people ORDER BY id").all() as PersonRow[];

  return rows.map((row) => ({
    id: String(row.id),
    data: {
      "first name": row.first_name,
      "last name": row.last_name,
      birthday: row.birthday,
      avatar: row.avatar,
      gender: row.gender as "M" | "F",
      generation: row.generation,
    },
    rels: {
      spouses: JSON.parse(row.spouses).map(String),
      children: JSON.parse(row.children).map(String),
      parents: JSON.parse(row.parents).map(String),
    },
  }));
}

function isIntegerId(id: string): boolean {
  const n = parseInt(id, 10);
  return String(n) === id && n >= 0;
}

/**
 * Replaces all family data. Automatically calculates generation for any
 * person who doesn't already have one set, based on their relationships:
 *   - Has parents in dataset   → max(parent generations) + 1
 *   - Has children in dataset  → min(child generations) - 1
 *   - Has a spouse with gen    → same as spouse
 *   - Fallback                 → 0
 */
export function replaceFamilyData(data: FamilyDatum[]): void {
  const database = getDb();

  // ── 1. Normalise IDs (same logic as before) ──────────────────────────────
  const existingIds = new Set<number>();
  for (const p of data) {
    const n = parseInt(p.id, 10);
    if (String(n) === p.id && n >= 0) existingIds.add(n);
  }
  let nextId = existingIds.size > 0 ? Math.max(...existingIds) + 1 : 1;
  const oldIdToNewId = new Map<string, string>();
  for (const p of data) {
    if (isIntegerId(p.id)) {
      oldIdToNewId.set(p.id, p.id);
    } else {
      oldIdToNewId.set(p.id, String(nextId++));
    }
  }
  const mapId = (id: string) => oldIdToNewId.get(id) ?? id;
  const mapIds = (ids: string[]) => (ids || []).map(mapId).filter(Boolean);

  // ── 2. Build a lookup of existing generations from the DB ─────────────────
  // So people who already have a generation keep it, only NEW people get calculated
  const existingGenMap = new Map<string, number>();
  try {
    const existingRows = database
      .prepare("SELECT id, generation FROM people")
      .all() as Array<{ id: number; generation: number }>;
    for (const row of existingRows) {
      existingGenMap.set(String(row.id), row.generation);
    }
  } catch {
    // table might be empty, that's fine
  }

  // ── 3. Calculate generations for the full dataset ─────────────────────────
  // Build a quick map of newId → datum for lookups
  const byNewId = new Map<string, FamilyDatum>();
  for (const p of data) {
    byNewId.set(mapId(p.id), p);
  }

  const genMap = new Map<string, number>();

  // Seed from existing DB values first
  for (const p of data) {
    const newId = mapId(p.id);
    const existingGen = existingGenMap.get(newId);
    // Also respect generation stored in data payload (from previous saves)
    const dataGen = p.data?.generation;
    if (typeof dataGen === "number") {
      genMap.set(newId, dataGen);
    } else if (existingGen !== undefined) {
      genMap.set(newId, existingGen);
    }
  }

  // Propagate: parents → children (+1), then spouses (same gen)
  // Run multiple passes until stable
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of data) {
      const newId = mapId(p.id);
      if (genMap.has(newId)) continue;

      const rels = p.rels ?? {};

      // Try parents first
      const parentGens = (rels.parents ?? [])
        .map((pid) => genMap.get(mapId(pid)))
        .filter((g): g is number => g !== undefined);
      if (parentGens.length > 0) {
        genMap.set(newId, Math.max(...parentGens) + 1);
        changed = true;
        continue;
      }

      // Try children — if I have a child, I'm one generation above them
      const childGens = (rels.children ?? [])
        .map((cid) => genMap.get(mapId(cid)))
        .filter((g): g is number => g !== undefined);
      if (childGens.length > 0) {
        genMap.set(newId, Math.min(...childGens) - 1);
        changed = true;
        continue;
      }

      // Try spouse
      for (const sid of rels.spouses ?? []) {
        const spouseGen = genMap.get(mapId(sid));
        if (spouseGen !== undefined) {
          genMap.set(newId, spouseGen);
          changed = true;
          break;
        }
      }
    }
  }

  // Absolute fallback
  for (const p of data) {
    const newId = mapId(p.id);
    if (!genMap.has(newId)) genMap.set(newId, 0);
  }

  // ── 4. Write to DB ────────────────────────────────────────────────────────
  const del = database.prepare("DELETE FROM people");
  const insert = database.prepare(`
    INSERT INTO people (id, first_name, last_name, birthday, avatar, gender, spouses, children, parents, generation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.transaction(() => {
    del.run();
    for (const p of data) {
      const newId = mapId(p.id);
      const d = p.data || {};
      insert.run(
        parseInt(newId, 10),
        String(d["first name"] ?? ""),
        String(d["last name"] ?? ""),
        String(d.birthday ?? ""),
        String(d.avatar ?? ""),
        String(d.gender ?? ""),
        JSON.stringify(mapIds(p.rels?.spouses ?? [])),
        JSON.stringify(mapIds(p.rels?.children ?? [])),
        JSON.stringify(mapIds(p.rels?.parents ?? [])),
        genMap.get(newId) ?? 0
      );
    }
  })();
}
