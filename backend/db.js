const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'surviraid.db');

let db = null;

function ensureDbDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function save() {
  ensureDbDir();
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  ensureDbDir();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS joueur (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pseudo TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'membre' CHECK(role IN ('membre', 'officier', 'admin')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS acces_instance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnage_id INTEGER NOT NULL,
      instance TEXT NOT NULL CHECK(instance IN ('MC', 'BWL', 'ONY', 'Naxx')),
      debloque INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (personnage_id) REFERENCES personnage(id) ON DELETE CASCADE,
      UNIQUE(personnage_id, instance)
    )
  `);

  db.run(`
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

  db.run(`
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

  try { db.run("ALTER TABLE preference_raid ADD COLUMN statut TEXT NOT NULL DEFAULT 'present'"); } catch (e) { /* already exists */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS frequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      joueur_id INTEGER UNIQUE NOT NULL,
      raids_par_semaine_max INTEGER NOT NULL DEFAULT 3,
      FOREIGN KEY (joueur_id) REFERENCES joueur(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jour_actif (
      jour TEXT PRIMARY KEY CHECK(jour IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche')),
      actif INTEGER NOT NULL DEFAULT 1
    )
  `);

  try { db.run('ALTER TABLE personnage ADD COLUMN role2 TEXT DEFAULT NULL CHECK(role2 IS NULL OR role2 IN (\'Tank\', \'Heal\', \'DPS\'))'); } catch (e) { /* column already exists */ }

  try { db.run("DELETE FROM preference_raid WHERE instance IN ('AQ20', 'ZG')"); } catch (e) { /* ignore */ }

  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  for (const j of jours) {
    db.run('INSERT OR IGNORE INTO jour_actif (jour, actif) VALUES (?, 1)', [j]);
  }

  save();
  return db;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastIdResult = db.exec("SELECT last_insert_rowid()");
  const lastId = lastIdResult.length > 0 ? lastIdResult[0].values[0][0] : null;
  save();
  return { lastId, changes };
}

module.exports = { getDb, queryAll, queryOne, run, save };
