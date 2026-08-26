const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'surviraid-secret-change-me';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token manquant' });

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

function officierMiddleware(req, res, next) {
  if (req.user.role !== 'officier' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux officiers' });
  }
  next();
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }
  next();
}

module.exports = { authMiddleware, officierMiddleware, adminMiddleware, JWT_SECRET };
