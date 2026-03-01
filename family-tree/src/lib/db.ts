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
      parents TEXT NOT NULL DEFAULT '[]'
    )
  `);

  const count = db.prepare("SELECT COUNT(*) as n FROM people").get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare(`
      INSERT INTO people (id, first_name, last_name, birthday, avatar, gender, spouses, children, parents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(p.rels.parents ?? [])
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
}

export type FamilyDatum = {
  id: string;
  data: Record<string, unknown>;
  rels: { spouses: string[]; children: string[]; parents: string[] };
};

/**
 * Returns family data in the format expected by family-chart.
 * IDs are stringified so they match the library's Datum type.
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
 * Replaces all family data in the database with the payload from the chart.
 * Normalizes IDs: existing integer ids are kept; new (non-integer) ids get the next available integer.
 */
export function replaceFamilyData(data: FamilyDatum[]): void {
  const database = getDb();

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

  const rows: Array<{
    id: number;
    first_name: string;
    last_name: string;
    birthday: string;
    avatar: string;
    gender: string;
    spouses: string;
    children: string;
    parents: string;
  }> = [];

  for (const p of data) {
    const newId = mapId(p.id);
    const d = p.data || {};
    rows.push({
      id: parseInt(newId, 10),
      first_name: String(d["first name"] ?? ""),
      last_name: String(d["last name"] ?? ""),
      birthday: String(d.birthday ?? ""),
      avatar: String(d.avatar ?? ""),
      gender: String(d.gender ?? ""),
      spouses: JSON.stringify(mapIds(p.rels?.spouses ?? [])),
      children: JSON.stringify(mapIds(p.rels?.children ?? [])),
      parents: JSON.stringify(mapIds(p.rels?.parents ?? [])),
    });
  }

  const del = database.prepare("DELETE FROM people");
  const insert = database.prepare(`
    INSERT INTO people (id, first_name, last_name, birthday, avatar, gender, spouses, children, parents)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.transaction(() => {
    del.run();
    for (const row of rows) {
      insert.run(
        row.id,
        row.first_name,
        row.last_name,
        row.birthday,
        row.avatar,
        row.gender,
        row.spouses,
        row.children,
        row.parents
      );
    }
  })();
}
