/**
 * Enrichit la base existante pour remplir parfois des raids 40 (Naxx / AQ40).
 * Usage: node enrich-raid-fill.js
 */
const bcrypt = require('bcryptjs');
const { getDb, queryAll, queryOne, run } = require('./db');

const CLASSES = ['Guerrier', 'Chasseur', 'Voleur', 'Prêtre', 'Chaman', 'Mage', 'Démoniste', 'Druide'];
const ROLES_BY_CLASS = {
  Guerrier: ['Tank', 'DPS'],
  Chasseur: ['DPS'],
  Voleur: ['DPS'],
  'Prêtre': ['Heal', 'DPS'],
  Chaman: ['Heal', 'DPS'],
  Mage: ['DPS'],
  'Démoniste': ['DPS'],
  Druide: ['Tank', 'Heal', 'DPS'],
};
const ACCESS_INSTANCES = ['MC', 'BWL', 'ONY', 'Naxx'];
const RAID40 = ['Naxx', 'AQ40'];

// Soirs « gros raid » ciblés
const RAID_NIGHTS = [
  { instance: 'Naxx', jour: 'Mardi', target: 42 },
  { instance: 'AQ40', jour: 'Samedi', target: 43 },
  { instance: 'Naxx', jour: 'Dimanche', target: 36 },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function uniqueName(used, prefix) {
  let i = 1;
  let nom;
  do { nom = `${prefix}${i++}`; } while (used.has(nom));
  used.add(nom);
  return nom;
}

function createAccount(pseudo, password) {
  const hash = bcrypt.hashSync(password, 10);
  const result = run('INSERT INTO joueur (pseudo, password_hash, role) VALUES (?, ?, ?)', [pseudo, hash, 'membre']);
  run('INSERT OR IGNORE INTO frequence (joueur_id, raids_par_semaine_max) VALUES (?, ?)', [result.lastId, rand(3, 5)]);
  return result.lastId;
}

function createMain(joueurId, nom) {
  const classe = pick(CLASSES);
  const role = pick(ROLES_BY_CLASS[classe]);
  const result = run(
    'INSERT INTO personnage (joueur_id, nom, classe, role, type) VALUES (?, ?, ?, ?, ?)',
    [joueurId, nom, classe, role, 'Main']
  );
  const charId = result.lastId;

  for (const inst of ACCESS_INSTANCES) {
    run('INSERT OR IGNORE INTO acces_instance (personnage_id, instance, debloque) VALUES (?, ?, ?)', [charId, inst, 1]);
  }
  for (const inst of RAID40) {
    run('INSERT OR IGNORE INTO validation_stuff (personnage_id, instance, statut) VALUES (?, ?, ?)', [charId, inst, 'valide']);
  }
  return charId;
}

function ensureSignup(charId, instance, jour, statut = 'present') {
  run(
    `INSERT INTO preference_raid (personnage_id, instance, jour, statut)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(personnage_id, instance, jour)
     DO UPDATE SET statut = excluded.statut`,
    [charId, instance, jour, statut]
  );
}

function countMainsForNight(instance, jour) {
  return queryOne(`
    SELECT COUNT(*) as c
    FROM preference_raid pr
    JOIN personnage p ON p.id = pr.personnage_id
    WHERE pr.instance = ? AND pr.jour = ? AND p.type = 'Main' AND pr.statut != 'absent'
  `, [instance, jour]).c;
}

function fillRaidNight(instance, jour, target) {
  const mains = queryAll("SELECT id FROM personnage WHERE type = 'Main'");
  const shuffled = shuffle(mains);

  for (const { id } of shuffled) {
    if (countMainsForNight(instance, jour) >= target) break;
    ensureSignup(id, instance, jour, 'present');
  }

  // Quelques absents / tentatives sur le même soir pour du réalisme
  const signed = queryAll(`
    SELECT pr.personnage_id as id
    FROM preference_raid pr
    JOIN personnage p ON p.id = pr.personnage_id
    WHERE pr.instance = ? AND pr.jour = ? AND p.type = 'Main' AND pr.statut = 'present'
  `, [instance, jour]);

  shuffle(signed).slice(0, rand(1, 3)).forEach(({ id }) => {
    ensureSignup(id, instance, jour, pick(['absent', 'tentative']));
  });

  return countMainsForNight(instance, jour);
}

async function main() {
  await getDb();

  const usedPseudos = new Set(queryAll('SELECT pseudo FROM joueur').map(r => r.pseudo));
  const usedNames = new Set(queryAll('SELECT nom FROM personnage').map(r => r.nom));

  const mainsCount = queryOne("SELECT COUNT(*) as c FROM personnage WHERE type = 'Main'").c;
  const minMainsNeeded = 58;

  if (mainsCount < minMainsNeeded) {
    const toCreate = minMainsNeeded - mainsCount;
    console.log(`Ajout de ${toCreate} joueurs supplémentaires...`);
    for (let i = 0; i < toCreate; i++) {
      const pseudo = uniqueName(usedPseudos, 'Raider');
      const nom = uniqueName(usedNames, 'Hero');
      const joueurId = createAccount(pseudo, 'test1234');
      createMain(joueurId, nom);
    }
  }

  console.log('Remplissage des soirs raid 40...');
  for (const night of RAID_NIGHTS) {
    const count = fillRaidNight(night.instance, night.jour, night.target);
    console.log(`  ${night.instance} ${night.jour}: ${count} mains présents/tentatives`);
  }

  // Quelques prefs sur d'autres raids/jours pour les membres existants
  const allMains = queryAll("SELECT id FROM personnage WHERE type = 'Main'");
  const otherInstances = ['BWL', 'MC', 'ONY'];
  const otherDays = ['Mercredi', 'Jeudi', 'Vendredi'];
  for (const { id } of shuffle(allMains).slice(0, Math.floor(allMains.length * 0.4))) {
    ensureSignup(id, pick(otherInstances), pick(otherDays), pick(['present', 'present', 'tentative']));
  }

  console.log('\n✅ Enrichissement terminé !');
  console.log(`   ${queryOne('SELECT COUNT(*) as c FROM joueur').c} joueurs`);
  console.log(`   ${queryOne("SELECT COUNT(*) as c FROM personnage WHERE type = 'Main'").c} mains`);
  console.log(`   ${queryOne('SELECT COUNT(*) as c FROM preference_raid').c} préférences`);

  for (const night of RAID_NIGHTS) {
    console.log(`   → ${night.instance} ${night.jour}: ${countMainsForNight(night.instance, night.jour)} mains`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
