const express = require('express');
const { queryAll, queryOne, run } = require('../db');
const { authMiddleware, officierMiddleware, adminMiddleware } = require('../middleware');

const router = express.Router();

// Validations — officier + admin
router.get('/validations', authMiddleware, officierMiddleware, (req, res) => {
  const validations = queryAll(`
    SELECT v.*, p.nom as personnage_nom, p.classe, p.role as personnage_role, j.pseudo as joueur_pseudo
    FROM validation_stuff v
    JOIN personnage p ON p.id = v.personnage_id
    JOIN joueur j ON j.id = p.joueur_id
    ORDER BY v.statut, j.pseudo
  `);
  res.json(validations);
});

router.put('/validations/:id', authMiddleware, officierMiddleware, (req, res) => {
  const { statut } = req.body;
  if (!['en_attente', 'valide', 'refuse'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  run('UPDATE validation_stuff SET statut = ?, valide_par = ?, updated_at = datetime("now") WHERE id = ?',
    [statut, req.user.id, Number(req.params.id)]);
  res.json({ ok: true });
});

// Gestion membres — admin seulement
router.get('/membres', authMiddleware, adminMiddleware, (req, res) => {
  const membres = queryAll(`
    SELECT j.id, j.pseudo, j.role, j.created_at,
      (SELECT COUNT(*) FROM personnage WHERE joueur_id = j.id) as nb_personnages
    FROM joueur j ORDER BY j.pseudo
  `);
  res.json(membres);
});

router.put('/membres/:id/role', authMiddleware, adminMiddleware, (req, res) => {
  const { role } = req.body;
  if (!['membre', 'officier', 'admin'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  run('UPDATE joueur SET role = ? WHERE id = ?', [role, Number(req.params.id)]);
  res.json({ ok: true });
});

router.delete('/membres/:id', authMiddleware, adminMiddleware, (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Impossible de se supprimer soi-même' });
  }
  run('DELETE FROM joueur WHERE id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
});

// Jours actifs — admin seulement
router.put('/jours/:jour', authMiddleware, adminMiddleware, (req, res) => {
  const { actif } = req.body;
  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  if (!jours.includes(req.params.jour)) return res.status(400).json({ error: 'Jour invalide' });
  run('UPDATE jour_actif SET actif = ? WHERE jour = ?', [actif ? 1 : 0, req.params.jour]);
  res.json({ ok: true });
});

module.exports = router;
