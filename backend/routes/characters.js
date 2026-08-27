const express = require('express');
const { queryAll, queryOne, run } = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

const CLASSES = ['Guerrier', 'Chasseur', 'Voleur', 'Prêtre', 'Chaman', 'Mage', 'Démoniste', 'Druide'];
const ROLES = ['Tank', 'Heal', 'DPS'];
const ACCESS_INSTANCES = ['MC', 'BWL', 'ONY', 'Naxx'];
const VALID_INSTANCES = ['AQ40', 'Naxx'];

router.get('/classes', (req, res) => {
  res.json({ classes: CLASSES, roles: ROLES });
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const chars = await queryAll('SELECT * FROM personnage WHERE joueur_id = ?', [req.user.id]);
    for (const c of chars) {
      c.acces = await queryAll('SELECT instance, debloque FROM acces_instance WHERE personnage_id = ?', [c.id]);
      c.validations = await queryAll('SELECT instance, statut FROM validation_stuff WHERE personnage_id = ?', [c.id]);
    }
    res.json(chars);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { nom, classe, role, role2, type, acces } = req.body;
    if (!nom || !classe || !role) {
      return res.status(400).json({ error: 'Nom, classe et rôle sont requis' });
    }
    if (!CLASSES.includes(classe)) return res.status(400).json({ error: 'Classe invalide' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
    if (role2 && !ROLES.includes(role2)) return res.status(400).json({ error: 'Rôle secondaire invalide' });

    const charType = type || 'Main';
    if (charType === 'Main') {
      const existingMain = await queryOne("SELECT id FROM personnage WHERE joueur_id = ? AND type = 'Main'", [req.user.id]);
      if (existingMain) return res.status(400).json({ error: 'Tu as déjà un Main. Change-le en Reroll d\'abord.' });
    }

    const result = await run(
      'INSERT INTO personnage (joueur_id, nom, classe, role, role2, type) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, nom, classe, role, role2 || null, charType]
    );

    const charId = result.lastId;

    for (const inst of ACCESS_INSTANCES) {
      const unlocked = acces?.[inst] ? 1 : 0;
      await run(
        'INSERT OR IGNORE INTO acces_instance (personnage_id, instance, debloque) VALUES (?, ?, ?)',
        [charId, inst, unlocked]
      );
    }

    for (const inst of VALID_INSTANCES) {
      await run(
        'INSERT OR IGNORE INTO validation_stuff (personnage_id, instance, statut) VALUES (?, ?, ?)',
        [charId, inst, 'en_attente']
      );
    }

    res.json({ id: charId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const char = await queryOne('SELECT * FROM personnage WHERE id = ? AND joueur_id = ?', [req.params.id, req.user.id]);
    if (!char) return res.status(404).json({ error: 'Personnage non trouvé' });

    const { nom, classe, role, role2, type, acces } = req.body;

    if (type === 'Main' && char.type !== 'Main') {
      const existingMain = await queryOne(
        "SELECT id FROM personnage WHERE joueur_id = ? AND type = 'Main' AND id != ?",
        [req.user.id, req.params.id]
      );
      if (existingMain) return res.status(400).json({ error: 'Tu as déjà un Main.' });
    }

    await run(
      'UPDATE personnage SET nom=?, classe=?, role=?, role2=?, type=? WHERE id=?',
      [nom, classe, role, role2 || null, type, req.params.id]
    );

    if (acces) {
      for (const inst of ACCESS_INSTANCES) {
        await run(
          'UPDATE acces_instance SET debloque = ? WHERE personnage_id = ? AND instance = ?',
          [acces[inst] ? 1 : 0, req.params.id, inst]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await run('DELETE FROM personnage WHERE id = ? AND joueur_id = ?', [req.params.id, req.user.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Personnage non trouvé' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
