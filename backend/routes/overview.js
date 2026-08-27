const express = require('express');
const { queryAll } = require('../db');

const router = express.Router();

const STUFF_REQUIRED = ['AQ40', 'Naxx'];

router.get('/', async (req, res) => {
  try {
    const data = await queryAll(`
      SELECT pr.instance, pr.jour, pr.statut as pref_statut,
             p.id as personnage_id, p.joueur_id, p.nom, p.classe, p.role, p.type,
             (SELECT nom FROM personnage pm WHERE pm.joueur_id = p.joueur_id AND pm.type = 'Main' LIMIT 1) as main_nom,
             (SELECT classe FROM personnage pm WHERE pm.joueur_id = p.joueur_id AND pm.type = 'Main' LIMIT 1) as main_classe,
             (SELECT role FROM personnage pm WHERE pm.joueur_id = p.joueur_id AND pm.type = 'Main' LIMIT 1) as main_role,
             j.pseudo as joueur_pseudo
      FROM preference_raid pr
      JOIN personnage p ON p.id = pr.personnage_id
      JOIN joueur j ON j.id = p.joueur_id
      ORDER BY pr.jour, pr.instance
    `);

    const validations = await queryAll('SELECT personnage_id, instance, statut FROM validation_stuff');
    const validMap = {};
    validations.forEach(v => { validMap[`${v.personnage_id}|${v.instance}`] = v.statut; });

    const activeDays = await queryAll('SELECT jour, actif FROM jour_actif');

    const result = {};
    for (const row of data) {
      const key = `${row.jour}|${row.instance}`;
      if (!result[key]) result[key] = { jour: row.jour, instance: row.instance, inscrits: [] };

      let stuffValide = true;
      let stuffStatut = null;
      if (STUFF_REQUIRED.includes(row.instance)) {
        stuffStatut = validMap[`${row.personnage_id}|${row.instance}`] || 'en_attente';
        stuffValide = stuffStatut === 'valide';
      }

      result[key].inscrits.push({
        nom: row.nom,
        classe: row.classe,
        role: row.role,
        type: row.type,
        joueurId: row.joueur_id,
        joueur: row.joueur_pseudo,
        mainNom: row.main_nom,
        mainClasse: row.main_classe,
        mainRole: row.main_role,
        stuffValide,
        stuffStatut,
        prefStatut: row.pref_statut || 'present',
      });
    }

    const joueurs = await queryAll(`
      SELECT j.id, j.pseudo, f.raids_par_semaine_max,
        (SELECT COUNT(*) FROM personnage WHERE joueur_id = j.id AND type = 'Main') as nb_mains,
        (SELECT COUNT(*) FROM personnage WHERE joueur_id = j.id AND type = 'Reroll') as nb_rerolls
      FROM joueur j
      LEFT JOIN frequence f ON f.joueur_id = j.id
    `);
    const joueursAvecPrefs = await queryAll(`
      SELECT DISTINCT j.id
      FROM joueur j
      JOIN personnage p ON p.joueur_id = j.id
      JOIN preference_raid pr ON pr.personnage_id = p.id
    `);

    const stats = {};
    stats.total_membres = joueurs.length;
    stats.membres_actifs = joueursAvecPrefs.length;
    stats.membres_sans_prefs = joueurs.length - joueursAvecPrefs.length;

    const freqs = joueurs.map(j => j.raids_par_semaine_max || 3);
    stats.freq_moyenne = freqs.length > 0 ? (freqs.reduce((a, b) => a + b, 0) / freqs.length).toFixed(1) : 0;
    stats.total_mains = joueurs.reduce((s, j) => s + j.nb_mains, 0);
    stats.total_rerolls = joueurs.reduce((s, j) => s + j.nb_rerolls, 0);

    const joursStats = {};
    Object.values(result).forEach(r => {
      const mainCount = r.inscrits.filter(i => i.type === 'Main').length;
      joursStats[r.jour] = (joursStats[r.jour] || 0) + mainCount;
    });
    stats.jour_stats = joursStats;

    res.json({ raids: Object.values(result), jours_actifs: activeDays, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
