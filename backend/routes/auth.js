const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne, queryAll, run } = require('../db');
const { JWT_SECRET, authMiddleware } = require('../middleware');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { pseudo, password } = req.body;
    if (!pseudo || !password) return res.status(400).json({ error: 'Pseudo et mot de passe requis' });
    if (password.length < 4) return res.status(400).json({ error: 'Mot de passe trop court (min 4)' });

    const existing = await queryOne('SELECT id FROM joueur WHERE pseudo = ?', [pseudo]);
    if (existing) return res.status(409).json({ error: 'Ce pseudo est déjà pris' });

    const hash = bcrypt.hashSync(password, 10);
    const count = await queryOne('SELECT COUNT(*) as c FROM joueur');
    const role = count.c === 0 ? 'admin' : 'membre';

    const result = await run('INSERT INTO joueur (pseudo, password_hash, role) VALUES (?, ?, ?)', [pseudo, hash, role]);
    await run('INSERT OR IGNORE INTO frequence (joueur_id, raids_par_semaine_max) VALUES (?, 3)', [result.lastId]);

    const token = jwt.sign({ id: result.lastId, pseudo, role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: result.lastId, pseudo, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { pseudo, password } = req.body;
    if (!pseudo || !password) return res.status(400).json({ error: 'Pseudo et mot de passe requis' });

    const user = await queryOne('SELECT * FROM joueur WHERE pseudo = ?', [pseudo]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
    }

    const token = jwt.sign({ id: user.id, pseudo: user.pseudo, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, pseudo: user.pseudo, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await queryOne('SELECT id, pseudo, role, created_at FROM joueur WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const freq = await queryOne('SELECT raids_par_semaine_max FROM frequence WHERE joueur_id = ?', [req.user.id]);
    res.json({ ...user, raids_par_semaine_max: freq?.raids_par_semaine_max ?? 3 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/frequence', authMiddleware, async (req, res) => {
  try {
    const { raids_par_semaine_max } = req.body;
    const existing = await queryOne('SELECT id FROM frequence WHERE joueur_id = ?', [req.user.id]);
    if (existing) {
      await run('UPDATE frequence SET raids_par_semaine_max = ? WHERE joueur_id = ?', [raids_par_semaine_max, req.user.id]);
    } else {
      await run('INSERT INTO frequence (joueur_id, raids_par_semaine_max) VALUES (?, ?)', [req.user.id, raids_par_semaine_max]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/membres', authMiddleware, async (req, res) => {
  try {
    const membres = await queryAll(`
      SELECT j.id, j.role,
        (SELECT COUNT(*) FROM personnage WHERE joueur_id = j.id) as nb_personnages,
        (SELECT COUNT(*) FROM preference_raid pr JOIN personnage p ON p.id = pr.personnage_id WHERE p.joueur_id = j.id) as nb_inscriptions
      FROM joueur j
      ORDER BY (SELECT nom FROM personnage pm WHERE pm.joueur_id = j.id AND pm.type = 'Main' LIMIT 1),
               j.id
    `);
    for (const m of membres) {
      const main = await queryOne("SELECT nom, classe, role FROM personnage WHERE joueur_id = ? AND type = 'Main' LIMIT 1", [m.id]);
      m.main_nom = main?.nom || null;
      m.main_classe = main?.classe || null;
    }
    res.json(membres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/profil/:id?', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id ? Number(req.params.id) : req.user.id;
    const user = await queryOne('SELECT id, role, created_at FROM joueur WHERE id = ?', [targetId]);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const freq = await queryOne('SELECT raids_par_semaine_max FROM frequence WHERE joueur_id = ?', [targetId]);
    user.raids_par_semaine_max = freq?.raids_par_semaine_max ?? 3;

    const chars = await queryAll('SELECT * FROM personnage WHERE joueur_id = ?', [targetId]);
    for (const c of chars) {
      c.acces = await queryAll('SELECT instance, debloque FROM acces_instance WHERE personnage_id = ?', [c.id]);
      c.validations = await queryAll('SELECT instance, statut FROM validation_stuff WHERE personnage_id = ?', [c.id]);
    }
    user.personnages = chars;

    const prefs = await queryAll(`
      SELECT pr.jour, pr.instance, p.nom as personnage_nom, p.classe, p.role, p.type
      FROM preference_raid pr
      JOIN personnage p ON p.id = pr.personnage_id
      WHERE p.joueur_id = ?
      ORDER BY CASE pr.jour WHEN 'Lundi' THEN 1 WHEN 'Mardi' THEN 2 WHEN 'Mercredi' THEN 3
        WHEN 'Jeudi' THEN 4 WHEN 'Vendredi' THEN 5 WHEN 'Samedi' THEN 6 WHEN 'Dimanche' THEN 7 END,
        pr.instance
    `, [targetId]);
    user.preferences = prefs;
    user.total_raids_semaine = new Set(prefs.map(p => `${p.jour}|${p.instance}`)).size;
    user.isOwn = targetId === req.user.id;

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
