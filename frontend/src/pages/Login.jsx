import { useState } from 'react';
import { api, setAuth } from '../api';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = isRegister
        ? await api.register(pseudo, password)
        : await api.login(pseudo, password);
      setAuth(data.token, data.user);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">⚔️ Les Survivants d'Azeroth</h1>
          <p className="login-subtitle">Les Survivants d'Azeroth — EU Auberdine</p>
          <p className="login-subtitle-small">Planificateur de raids — WoW Classic ERA — Horde</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <h2>{isRegister ? 'Inscription' : 'Connexion'}</h2>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>Pseudo de guilde</label>
            <input
              type="text"
              value={pseudo}
              onChange={e => setPseudo(e.target.value)}
              placeholder="Ton pseudo en jeu"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 4 caractères"
              required
              minLength={4}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Chargement...' : (isRegister ? "S'inscrire" : 'Se connecter')}
          </button>

          <p className="login-toggle">
            {isRegister ? 'Déjà inscrit ?' : 'Pas encore de compte ?'}
            <button type="button" className="btn-link" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
              {isRegister ? 'Se connecter' : "S'inscrire"}
            </button>
          </p>

          {isRegister && (
            <p className="login-note">
              Le premier compte créé devient automatiquement officier (admin).
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
