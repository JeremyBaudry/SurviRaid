const path = require('path');
const { createClient } = require('@libsql/client');

let client = null;

function getClientConfig() {
  if (process.env.TURSO_DATABASE_URL) {
    return {
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    };
  }

  const dbPath = process.env.DB_PATH || path.join(__dirname, 'surviraid.db');
  const normalized = dbPath.replace(/\\/g, '/');
  return { url: `file:${normalized}` };
}

async function getDb() {
  if (client) return client;

  client = createClient(getClientConfig());
  console.log(
    process.env.TURSO_DATABASE_URL
      ? 'DB: Turso (persistant)'
      : `DB: fichier local (${process.env.DB_PATH || 'surviraid.db'})`
  );

  await client.execute('PRAGMA foreign_keys = ON');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS joueur (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pseudo TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'membre' CHECK(role IN ('membre', 'officier', 'admin')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS personnage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      joueur_id INTEGER NOT NULL,
      nom TEXT NOT NULL,
      classe TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'DPS' CHECK(role IN ('Tank', 'Heal', 'DPS')),
      role2 TEXT DEFAULT NULL CHECK(role2 IS NULL OR role2 IN ('Tank', 'Heal', 'DPS')),
      type TEXT NOT NULL DEFAULT 'Main' CHECK(type IN ('Main', 'Reroll')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (joueur_id) REFERENCES joueur(id) ON DELETE CASCADE
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS acces_instance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnage_id INTEGER NOT NULL,
      instance TEXT NOT NULL CHECK(instance IN ('MC', 'BWL', 'ONY', 'Naxx')),
      debloque INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (personnage_id) REFERENCES personnage(id) ON DELETE CASCADE,
      UNIQUE(personnage_id, instance)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS validation_stuff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnage_id INTEGER NOT NULL,
      instance TEXT NOT NULL CHECK(instance IN ('AQ40', 'Naxx')),
      statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'valide', 'refuse')),
      valide_par INTEGER,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (personnage_id) REFERENCES personnage(id) ON DELETE CASCADE,
      FOREIGN KEY (valide_par) REFERENCES joueur(id),
      UNIQUE(personnage_id, instance)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS preference_raid (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnage_id INTEGER NOT NULL,
      instance TEXT NOT NULL CHECK(instance IN ('MC', 'BWL', 'ONY', 'AQ40', 'Naxx')),
      jour TEXT NOT NULL CHECK(jour IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche')),
      statut TEXT NOT NULL DEFAULT 'present' CHECK(statut IN ('present', 'tentative', 'absent')),
      FOREIGN KEY (personnage_id) REFERENCES personnage(id) ON DELETE CASCADE,
      UNIQUE(personnage_id, instance, jour)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS frequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      joueur_id INTEGER UNIQUE NOT NULL,
      raids_par_semaine_max INTEGER NOT NULL DEFAULT 3,
      FOREIGN KEY (joueur_id) REFERENCES joueur(id) ON DELETE CASCADE
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS jour_actif (
      jour TEXT PRIMARY KEY CHECK(jour IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche')),
      actif INTEGER NOT NULL DEFAULT 1
    )
  `);

  try {
    await client.execute("ALTER TABLE preference_raid ADD COLUMN statut TEXT NOT NULL DEFAULT 'present'");
  } catch (_) { /* already exists */ }

  try {
    await client.execute("ALTER TABLE personnage ADD COLUMN role2 TEXT DEFAULT NULL");
  } catch (_) { /* already exists */ }

  try {
    await client.execute("DELETE FROM preference_raid WHERE instance IN ('AQ20', 'ZG')");
  } catch (_) { /* ignore */ }

  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  for (const j of jours) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO jour_actif (jour, actif) VALUES (?, 1)',
      args: [j],
    });
  }

  return client;
}

async function queryAll(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows.map((row) => {
    const obj = {};
    for (const col of result.columns) {
      let val = row[col];
      if (typeof val === 'bigint') val = Number(val);
      obj[col] = val;
    }
    return obj;
  });
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  const lastId = result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null;
  return { lastId, changes: result.rowsAffected || 0 };
}

module.exports = { getDb, queryAll, queryOne, run };
