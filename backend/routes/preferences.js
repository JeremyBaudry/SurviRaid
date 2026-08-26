const express = require('express');
const { queryAll, run } = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

const ALL_INSTANCES = ['MC', 'BWL', 'ONY', 'AQ40', 'Naxx'];

router.get('/', authMiddleware, (req, res) => {
  const prefs = queryAll(`
    SELECT pr.*, p.nom as personnage_nom, p.classe as personnage_classe, p.type as personnage_type
    FROM preference_raid pr
    JOIN personnage p ON p.id = pr.personnage_id
    WHERE p.joueur_id = ?
  `, [req.user.id]);
  res.json(prefs);
});

router.put('/', authMiddleware, (req, res) => {
  try {
    const { preferences } = req.body;
    if (!Array.isArray(preferences)) return res.status(400).json({ error: 'Format invalide' });

    const ownedChars = queryAll('SELECT id FROM personnage WHERE joueur_id = ?', [req.user.id]).map(c => c.id);
    const activeDays = queryAll('SELECT jour FROM jour_actif WHERE actif = 1').map(d => d.jour);

    console.log('Save prefs:', { userId: req.user.id, ownedChars, activeDays, prefsCount: preferences.length });

    for (const charId of ownedChars) {
      run('DELETE FROM preference_raid WHERE personnage_id = ?', [charId]);
    }
    let inserted = 0;
    for (const pref of preferences) {
      const charId = Number(pref.personnage_id);
      if (!ownedChars.includes(charId)) continue;
      if (!ALL_INSTANCES.includes(pref.instance)) continue;
      if (!activeDays.includes(pref.jour)) continue;
      const statut = ['present', 'tentative', 'absent'].includes(pref.statut) ? pref.statut : 'present';
      run('INSERT OR IGNORE INTO preference_raid (personnage_id, instance, jour, statut) VALUES (?, ?, ?, ?)',
        [charId, pref.instance, pref.jour, statut]);
      inserted++;
    }
    console.log('Inserted prefs:', inserted);
    res.json({ ok: true, inserted });
  } catch (err) {
    console.error('Prefs error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/jours-actifs', (req, res) => {
  const jours = queryAll(`SELECT * FROM jour_actif ORDER BY
    CASE jour WHEN 'Lundi' THEN 1 WHEN 'Mardi' THEN 2 WHEN 'Mercredi' THEN 3
    WHEN 'Jeudi' THEN 4 WHEN 'Vendredi' THEN 5 WHEN 'Samedi' THEN 6 WHEN 'Dimanche' THEN 7 END`);
  res.json(jours);
});

module.exports = router;
