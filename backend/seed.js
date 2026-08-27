const { getDb, queryAll, queryOne, run } = require('./db');
const bcrypt = require('bcryptjs');

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
const VALID_INSTANCES = ['AQ40', 'Naxx'];
const ALL_INSTANCES = ['Naxx', 'AQ40', 'BWL', 'ONY', 'MC'];
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const RANDOM_NAMES = [
  'Thrarak', 'Zugtar', 'Morka', 'Grishnak', 'Zulgor', 'Kargath', 'Drekash', 'Volrok',
  'Grommash', 'Nazgrim', 'Roktar', 'Shakul', 'Zinjin', 'Malakar', 'Vorash', 'Zekthar',
  'Grukash', 'Tornak', 'Drezzak', 'Gormlok', 'Braktar', 'Skullcrag', 'Razgul', 'Thornfang',
  'Darkfury', 'Rotgut', 'Bonechill', 'Shadowmaw', 'Doomhowl', 'Nightbane', 'Ashenveil',
  'Bloodrune', 'Grimtotem', 'Soulreap', 'Plaguefist', 'Felstorm', 'Voidclaw', 'Hexfang',
  'Spiritwind', 'Earthshaker', 'Thunderhoof', 'Stormrage', 'Moonfire', 'Lifebinder',
  'Wildmane', 'Ironhide', 'Frostbite', 'Emberclaw', 'Warpblade', 'Netherscar',
  'Runebreaker', 'Duskwalker', 'Blazefury', 'Stonewall', 'Ravencrest', 'Deathwhisper',
];

const RANDOM_PSEUDOS = [
  'Darkshade', 'Pyromax', 'Frostbyte', 'Healbot', 'Tankzilla', 'Sneakythief',
  'Boomkin', 'Shockwave', 'Lifetap', 'Backstab', 'Moonbeam', 'Lavaburster',
  'Chainlightn', 'Venomstrike', 'Soulfire', 'Holynova', 'Earthtotem', 'Feralrage',
  'Arcaneblast', 'Shadowbolt', 'Multishot', 'Mortalstrik', 'Rejuvenate', 'Flameshock',
  'Mindblast', 'Corruption', 'Starfall', 'Raptorstrik', 'Thunderclap', 'Renew',
  'Eviscerate', 'Pyroblast', 'Frostshock', 'Shieldwall', 'Manaburn', 'Hexmaster',
  'Totemic', 'Wildgrowth', 'Searing', 'Decimate', 'Purify', 'Rampage',
  'Demonology', 'Berserking', 'Windwalker', 'Naturswrath', 'Reckless', 'Vanquish',
  'Spellweave', 'Bloodfrenzy',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function uniqueName(used, pool, fallbackPrefix) {
  const available = pool.filter(n => !used.has(n));
  if (available.length > 0) {
    const nom = pick(available);
    used.add(nom);
    return nom;
  }
  let i = 1;
  let nom;
  do { nom = `${fallbackPrefix}${i++}`; } while (used.has(nom));
  used.add(nom);
  return nom;
}

async function createAccount(pseudo, password, role) {
  const hash = bcrypt.hashSync(password, 10);
  const result = await run('INSERT INTO joueur (pseudo, password_hash, role) VALUES (?, ?, ?)', [pseudo, hash, role]);
  await run('INSERT OR IGNORE INTO frequence (joueur_id, raids_par_semaine_max) VALUES (?, ?)', [result.lastId, rand(2, 5)]);
  return result.lastId;
}

async function createChar(joueurId, nom, classe, role, type, acces) {
  const result = await run('INSERT INTO personnage (joueur_id, nom, classe, role, type) VALUES (?, ?, ?, ?, ?)',
    [joueurId, nom, classe, role, type]);
  const charId = result.lastId;

  for (const inst of ACCESS_INSTANCES) {
    const unlocked = acces?.includes(inst) ? 1 : 0;
    await run('INSERT OR IGNORE INTO acces_instance (personnage_id, instance, debloque) VALUES (?, ?, ?)', [charId, inst, unlocked]);
  }
  for (const inst of VALID_INSTANCES) {
    const statut = acces?.includes(inst) ? 'valide' : 'en_attente';
    await run('INSERT OR IGNORE INTO validation_stuff (personnage_id, instance, statut) VALUES (?, ?, ?)', [charId, inst, statut]);
  }
  return charId;
}

async function addPreferences(charId, count) {
  const joursChoisis = JOURS.sort(() => Math.random() - 0.5).slice(0, rand(2, Math.min(count, 5)));
  const instancesChoisies = ALL_INSTANCES.sort(() => Math.random() - 0.5).slice(0, rand(1, 3));
  for (const jour of joursChoisis) {
    for (const inst of instancesChoisies) {
      await run('INSERT OR IGNORE INTO preference_raid (personnage_id, instance, jour) VALUES (?, ?, ?)', [charId, inst, jour]);
    }
  }
}

async function seed() {
  const fs = require('fs');
  const path = require('path');
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'surviraid.db');
  if (!process.env.TURSO_DATABASE_URL && fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  await getDb();
  console.log('Seeding...');

  const cycoId = await createAccount('Cyco', '187187', 'admin');
  console.log('Créé: Cyco (admin) id=' + cycoId);

  const cycoMainId = await createChar(cycoId, 'Cyco', 'Voleur', 'DPS', 'Main', ACCESS_INSTANCES);
  await addPreferences(cycoMainId, 4);
  console.log('  Main: Cyco (Voleur DPS) - accès à tout');

  await createChar(cycoId, 'Yenemillas', 'Guerrier', 'DPS', 'Reroll', []);
  console.log('  Reroll: Yenemillas (Guerrier DPS)');

  await createChar(cycoId, 'Hoo', 'Prêtre', 'Heal', 'Reroll', []);
  console.log('  Reroll: Hoo (Prêtre Heal)');

  await createChar(cycoId, 'Ptitagité', 'Druide', 'Tank', 'Reroll', []);
  console.log('  Reroll: Ptitagité (Druide Tank)');

  await createChar(cycoId, 'Knock', 'Mage', 'DPS', 'Reroll', ACCESS_INSTANCES);
  console.log('  Reroll: Knock (Mage DPS) - accès à tout');

  const usedPseudos = new Set(['Cyco']);
  const usedNames = new Set(['Cyco', 'Yenemillas', 'Hoo', 'Ptitagité', 'Knock']);

  for (let i = 0; i < 45; i++) {
    const pseudo = uniqueName(usedPseudos, RANDOM_PSEUDOS, 'Player');

    const role = i < 3 ? 'officier' : 'membre';
    const joueurId = await createAccount(pseudo, 'test1234', role);

    const mainClasse = pick(CLASSES);
    const mainRole = pick(ROLES_BY_CLASS[mainClasse]);
    const mainNom = uniqueName(usedNames, RANDOM_NAMES, 'Hero');

    const hasAccess = Math.random() > 0.3;
    const mainAccess = hasAccess ? ACCESS_INSTANCES.filter(() => Math.random() > 0.3) : [];
    const mainId = await createChar(joueurId, mainNom, mainClasse, mainRole, 'Main', mainAccess);
    await addPreferences(mainId, 4);

    if (Math.random() > 0.7) {
      const rerollClasse = pick(CLASSES.filter(c => c !== mainClasse));
      const rerollRole = pick(ROLES_BY_CLASS[rerollClasse]);
      const rerollNom = uniqueName(usedNames, RANDOM_NAMES, 'Alt');

      const rerollId = await createChar(joueurId, rerollNom, rerollClasse, rerollRole, 'Reroll', []);
      if (Math.random() > 0.5) await addPreferences(rerollId, 2);
    }

    console.log(`Créé: ${pseudo} (${role}) — ${mainNom} ${mainClasse} ${mainRole}`);
  }

  const allValidations = await queryAll('SELECT id FROM validation_stuff');
  for (const v of allValidations) {
    if (Math.random() > 0.6) {
      await run("UPDATE validation_stuff SET statut = 'valide' WHERE id = ?", [v.id]);
    }
  }

  console.log('\n✅ Seed terminé !');
  console.log(`   ${(await queryOne('SELECT COUNT(*) as c FROM joueur')).c} joueurs`);
  console.log(`   ${(await queryOne('SELECT COUNT(*) as c FROM personnage')).c} personnages`);
  console.log(`   ${(await queryOne('SELECT COUNT(*) as c FROM preference_raid')).c} préférences`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
