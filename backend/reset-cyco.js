const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getDb, queryOne, run } = require('./db');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'surviraid.db');
const ACCESS_INSTANCES = ['MC', 'BWL', 'ONY', 'Naxx'];

async function createChar(joueurId, nom, classe, role, type, acces) {
  const result = await run(
    'INSERT INTO personnage (joueur_id, nom, classe, role, type) VALUES (?, ?, ?, ?, ?)',
    [joueurId, nom, classe, role, type]
  );
  const charId = result.lastId;

  for (const inst of ACCESS_INSTANCES) {
    const unlocked = acces?.includes(inst) ? 1 : 0;
    await run('INSERT OR IGNORE INTO acces_instance (personnage_id, instance, debloque) VALUES (?, ?, ?)', [charId, inst, unlocked]);
  }
  for (const inst of ['AQ40', 'Naxx']) {
    const statut = acces?.includes(inst) ? 'valide' : 'en_attente';
    await run('INSERT OR IGNORE INTO validation_stuff (personnage_id, instance, statut) VALUES (?, ?, ?)', [charId, inst, statut]);
  }
  return charId;
}

async function reset() {
  if (!process.env.TURSO_DATABASE_URL && fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  await getDb();

  if (process.env.TURSO_DATABASE_URL) {
    // Turso: vider les tables au lieu de supprimer le fichier
    for (const table of ['preference_raid', 'validation_stuff', 'acces_instance', 'personnage', 'frequence', 'joueur']) {
      await run(`DELETE FROM ${table}`);
    }
  }

  const hash = bcrypt.hashSync('187187', 10);
  const result = await run('INSERT INTO joueur (pseudo, password_hash, role) VALUES (?, ?, ?)', ['Cyco', hash, 'admin']);
  const cycoId = result.lastId;

  await run('INSERT INTO frequence (joueur_id, raids_par_semaine_max) VALUES (?, ?)', [cycoId, 3]);

  await createChar(cycoId, 'Cyco', 'Voleur', 'DPS', 'Main', ACCESS_INSTANCES);
  await createChar(cycoId, 'Yenemillas', 'Guerrier', 'DPS', 'Reroll', []);
  await createChar(cycoId, 'Hoo', 'Prêtre', 'Heal', 'Reroll', []);
  await createChar(cycoId, 'Ptitagité', 'Druide', 'Tank', 'Reroll', []);
  await createChar(cycoId, 'Knock', 'Mage', 'DPS', 'Reroll', ACCESS_INSTANCES);

  console.log('✅ Base réinitialisée');
  console.log(`   Compte: Cyco (admin) — mot de passe: 187187`);
  console.log(`   ${(await queryOne('SELECT COUNT(*) as c FROM joueur')).c} joueur(s)`);
  console.log(`   ${(await queryOne('SELECT COUNT(*) as c FROM personnage')).c} personnage(s)`);
  process.exit(0);
}

reset().catch(err => { console.error(err); process.exit(1); });
