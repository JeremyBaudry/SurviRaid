import { useState, useEffect } from 'react';
import { api } from '../api';
import { ClassIcon, TYPE_ICONS, INSTANCE_ICONS } from '../wowIcons.jsx';

const ACCESS_INSTANCES = ['MC', 'BWL', 'ONY', 'Naxx'];

const CLASS_COLORS = {
  Guerrier: '#C79C6E', Chasseur: '#ABD473', Voleur: '#FFF569',
  'Prêtre': '#FFFFFF', Chaman: '#0070DE', Mage: '#69CCF0', 'Démoniste': '#9482C9', Druide: '#FF7D0A',
};

const ROLE_ICONS = { Tank: '🛡️', Heal: '💚', DPS: '⚔️' };

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

export default function Characters() {
  const [chars, setChars] = useState([]);
  const [classesData, setClassesData] = useState({ classes: [], roles: [] });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nom: '', classe: '', role: 'DPS', role2: '', type: 'Main', acces: {} });
  const [error, setError] = useState('');
  const [freq, setFreq] = useState(3);
  const [freqSaving, setFreqSaving] = useState(false);
  const [freqMsg, setFreqMsg] = useState('');

  useEffect(() => {
    load();
    api.getClasses().then(setClassesData);
    api.me().then(u => setFreq(u.raids_par_semaine_max));
  }, []);

  async function load() {
    const data = await api.getCharacters();
    setChars(data);
  }

  const hasMain = chars.some(c => c.type === 'Main');

  function resetForm() {
    setForm({ nom: '', classe: '', role: 'DPS', role2: '', type: hasMain ? 'Reroll' : 'Main', acces: {} });
    setEditing(null);
    setError('');
  }

  function editChar(c) {
    const acces = {};
    c.acces?.forEach(a => { acces[a.instance] = !!a.debloque; });
    setForm({ nom: c.nom, classe: c.classe, role: c.role, role2: c.role2 || '', type: c.type, acces });
    setEditing(c.id);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.updateCharacter(editing, form);
      } else {
        await api.createCharacter(form);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce personnage ?')) return;
    await api.deleteCharacter(id);
    load();
  }

  async function saveFreq() {
    setFreqSaving(true);
    setFreqMsg('');
    try {
      await api.setFrequence(freq);
      setFreqMsg('Sauvegardé !');
      setTimeout(() => setFreqMsg(''), 2000);
    } catch (err) {
      setFreqMsg('Erreur: ' + err.message);
    } finally {
      setFreqSaving(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Mes Personnages</h1>

      <div className="card">
        <h2>Fréquence de raid souhaitée</h2>
        <p className="hint">Combien de soirs de raid maximum par semaine ?</p>
        <div className="freq-control">
          <button className="btn btn-sm" onClick={() => setFreq(Math.max(1, freq - 1))}>−</button>
          <span className="freq-value">{freq} soir{freq > 1 ? 's' : ''} / semaine</span>
          <button className="btn btn-sm" onClick={() => setFreq(Math.min(7, freq + 1))}>+</button>
          <button className="btn btn-primary btn-sm" onClick={saveFreq} disabled={freqSaving} style={{ marginLeft: '1rem' }}>
            {freqSaving ? '...' : 'Sauvegarder'}
          </button>
          {freqMsg && <span className="freq-msg">{freqMsg}</span>}
        </div>
      </div>

      <div className="card">
        <h2>{editing ? 'Modifier le personnage' : 'Créer un personnage'}</h2>
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="char-form">
          {/* Identité */}
          <div className="form-section">
            <div className="form-section-title">⚔️ Identité</div>
            <div className="form-row-3">
              <div className="form-group">
                <label>Nom</label>
                <input type="text" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} required />
              </div>
              <div className="form-group">
              <label>Classe</label>
              <select value={form.classe} onChange={e => {
                const newClasse = e.target.value;
                const roles = ROLES_BY_CLASS[newClasse] || ['DPS'];
                const newRole = roles.includes(form.role) ? form.role : roles[0];
                const newRole2 = roles.length <= 1 ? '' : (roles.includes(form.role2) && form.role2 !== newRole ? form.role2 : '');
                setForm({ ...form, classe: newClasse, role: newRole, role2: newRole2 });
              }} required>
                  <option value="">-- Choisir --</option>
                  {classesData.classes?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="Main" disabled={hasMain && !editing}>Main{hasMain && !editing ? ' (déjà défini)' : ''}</option>
                  <option value="Reroll">Reroll</option>
                </select>
              </div>
            </div>
          </div>

          {/* Spécialisations */}
          {(() => {
            const availableRoles = ROLES_BY_CLASS[form.classe] || ['Tank', 'Heal', 'DPS'];
            const hasSecondary = availableRoles.length > 1;
            return (
            <div className="form-section">
              <div className="form-section-title">🎯 Spécialisations</div>
              <div className="form-row">
                <div className="form-group role-box">
                  <label>Rôle principal</label>
                  <div className="role-picker">
                    {availableRoles.map(r => (
                      <button
                        key={r}
                        type="button"
                        className={`role-btn ${form.role === r ? 'role-btn-active' : ''}`}
                        onClick={() => setForm({ ...form, role: r, role2: form.role2 === r ? '' : form.role2 })}
                      >
                        {ROLE_ICONS[r]} {r}
                      </button>
                    ))}
                  </div>
                </div>
                {hasSecondary && (
                <div className="form-group role-box">
                  <label>Rôle secondaire <span style={{ color: '#888', fontWeight: 'normal' }}>(facultatif)</span></label>
                  <div className="role-picker">
                    <button
                      type="button"
                      className={`role-btn ${!form.role2 ? 'role-btn-active' : ''}`}
                      onClick={() => setForm({ ...form, role2: '' })}
                      style={{ opacity: !form.role2 ? 1 : 0.6 }}
                    >
                      ❌ Aucun
                    </button>
                    {availableRoles.filter(r => r !== form.role).map(r => (
                      <button
                        key={r}
                        type="button"
                        className={`role-btn ${form.role2 === r ? 'role-btn-active' : ''}`}
                        onClick={() => setForm({ ...form, role2: r })}
                      >
                        {ROLE_ICONS[r]} {r}
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* Accès */}
          <div className="form-section">
            <div className="form-section-title">🔑 Accès aux instances</div>
            <div className="access-grid">
              {ACCESS_INSTANCES.map(inst => {
                const checked = !!form.acces[inst];
                return (
                  <div
                    key={inst}
                    className={`access-card ${checked ? 'access-card-unlocked' : 'access-card-locked'}`}
                    onClick={() => setForm({ ...form, acces: { ...form.acces, [inst]: !checked } })}
                  >
                    <span className="access-icon">{INSTANCE_ICONS[inst] || '🏰'}</span>
                    <span className="access-name">{inst}</span>
                    <span className="access-status">{checked ? '✅' : '❌'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-lg">{editing ? '✏️ Modifier' : '➕ Créer le personnage'}</button>
            {editing && <button type="button" className="btn btn-lg" onClick={resetForm}>Annuler</button>}
          </div>
        </form>
      </div>

      <div className="chars-list">
        {chars.map(c => (
          <div key={c.id} className="card char-card">
            <div className="char-header">
              <ClassIcon classe={c.classe} size={24} />
              <span className="char-name" style={{ color: CLASS_COLORS[c.classe] || '#fff' }}>{c.nom}</span>
              <span className={`badge badge-${c.type.toLowerCase()}`}>{TYPE_ICONS[c.type]} {c.type}</span>
              <span className="role-badge">{ROLE_ICONS[c.role]} {c.role}</span>
              {c.role2 && <span className="role-badge" style={{ opacity: 0.7 }}>{ROLE_ICONS[c.role2]} {c.role2} (2nde spé)</span>}
            </div>
            <div className="char-info">
              <span>{c.classe}</span>
            </div>
            <div className="char-access">
              {c.acces?.map(a => (
                <span key={a.instance} className={`tag ${a.debloque ? 'tag-ok' : 'tag-locked'}`}>
                  {a.instance} {a.debloque ? '✓' : '✗'}
                </span>
              ))}
            </div>
            <div className="char-validations">
              {c.validations?.filter(v => v.instance).map(v => (
                <span key={v.instance} className={`tag tag-${v.statut}`}>
                  {v.instance}: {v.statut === 'valide' ? '✓ Validé' : v.statut === 'refuse' ? '✗ Refusé' : '⏳ En attente'}
                </span>
              ))}
            </div>
            <div className="char-actions">
              <button className="btn btn-sm" onClick={() => editChar(c)}>Modifier</button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>Supprimer</button>
            </div>
          </div>
        ))}
        {chars.length === 0 && <p className="empty-state">Aucun personnage. Crée ton premier personnage ci-dessus !</p>}
      </div>
    </div>
  );
}
