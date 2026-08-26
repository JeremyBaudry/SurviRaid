const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');

async function start() {
  await getDb();

  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/characters', require('./routes/characters'));
  app.use('/api/preferences', require('./routes/preferences'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/overview', require('./routes/overview'));

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`SurviRaid API running on port ${PORT}`);
  });
}

start().catch(console.error);
