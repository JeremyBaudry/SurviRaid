const express = require('express');
const { queryAll, run } = require('../db');
const { authMiddleware, officierMiddleware, adminMiddleware } = require('../middleware');

const router = express.Router();

router.get('/validations', authMiddleware, officierMiddleware, async (req, res) => {
  try {
    const validations = await queryAll(`
      SELECT v.*, p.nom as personnage_nom, p.classe, p.role as personnage_role, j.pseudo as joueur_pseudo
      FROM validation_stuff v
      JOIN personnage p ON p.id = v.personnage_id
      JOIN joueur j ON j.id = p.joueur_id
      ORDER BY v.statut, j.pseudo
    `);
    res.json(validations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/validations/:id', authMiddleware, officierMiddleware, async (req, res) => {
  try {
    const { statut } = req.body;
    if (!['en_attente', 'valide', 'refuse'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    await run(
      'UPDATE validation_stuff SET statut = ?, valide_par = ?, updated_at = datetime("now") WHERE id = ?',
      [statut, req.user.id, Number(req.params.id)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/membres', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const membres = await queryAll(`
      SELECT j.id, j.pseudo, j.role, j.created_at,
        (SELECT COUNT(*) FROM personnage WHERE joueur_id = j.id) as nb_personnages
      FROM joueur j ORDER BY j.pseudo
    `);
    res.json(membres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/membres/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['membre', 'officier', 'admin'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
    await run('UPDATE joueur SET role = ? WHERE id = ?', [role, Number(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/membres/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Impossible de se supprimer soi-même' });
    }
    await run('DELETE FROM joueur WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/jours/:jour', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { actif } = req.body;
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    if (!jours.includes(req.params.jour)) return res.status(400).json({ error: 'Jour invalide' });
    await run('UPDATE jour_actif SET actif = ? WHERE jour = ?', [actif ? 1 : 0, req.params.jour]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
