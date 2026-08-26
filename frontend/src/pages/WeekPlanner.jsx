import { useState, useEffect } from 'react';
import { api } from '../api';
import { INSTANCE_ICONS, ClassIcon, TYPE_ICONS } from '../wowIcons.jsx';

const ALL_INSTANCES = ['Naxx', 'AQ40', 'BWL', 'ONY', 'MC'];
const STUFF_REQUIRED = ['AQ40', 'Naxx'];

const CLASS_COLORS = {
  Guerrier: '#C79C6E', Paladin: '#F58CBA', Chasseur: '#ABD473', Voleur: '#FFF569',
  'Prêtre': '#FFFFFF', Chaman: '#0070DE', Mage: '#69CCF0', 'Démoniste': '#9482C9', Druide: '#FF7D0A',
};

const STATUT_CYCLE = [null, 'present', 'tentative', 'absent'];
const STATUT_DISPLAY = {
  present: { icon: '⚔️', label: 'Présent' },
  tentative: { icon: '❓', label: 'Tentative' },
  absent: { icon: '🚫', label: 'Absent' },
};

export default function WeekPlanner() {
  const [chars, setChars] = useState([]);
  const [prefs, setPrefs] = useState([]);
  const [jours, setJours] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([api.getCharacters(), api.getPreferences(), api.getJoursActifs()])
      .then(([c, p, j]) => { setChars(c); setPrefs(p); setJours(j); });
  }, []);

  const activeJours = jours.filter(j => j.actif).map(j => j.jour);

  function getKey(charId, instance, jour) {
    return `${charId}|${instance}|${jour}`;
  }

  function getPrefMap() {
    const map = {};
    for (const p of prefs) {
      map[getKey(p.personnage_id, p.instance, p.jour)] = p.statut || 'present';
    }
    return map;
  }

  const prefMap = getPrefMap();

  function cycleStatus(charId, instance, jour) {
    const key = getKey(charId, instance, jour);
    const current = prefMap[key] || null;
    const idx = STATUT_CYCLE.indexOf(current);
    const next = STATUT_CYCLE[(idx + 1) % STATUT_CYCLE.length];

    if (next === null) {
      setPrefs(prefs.filter(p => getKey(p.personnage_id, p.instance, p.jour) !== key));
    } else {
      const existing = prefs.find(p => getKey(p.personnage_id, p.instance, p.jour) === key);
      if (existing) {
        setPrefs(prefs.map(p => getKey(p.personnage_id, p.instance, p.jour) === key ? { ...p, statut: next } : p));
      } else {
        setPrefs([...prefs, { personnage_id: charId, instance, jour, statut: next }]);
      }
    }
  }

  function setAllForChar(charId, statut) {
    const otherPrefs = prefs.filter(p => Number(p.personnage_id) !== charId);
    if (statut === null) {
      setPrefs(otherPrefs);
    } else {
      const newEntries = [];
      for (const inst of ALL_INSTANCES) {
        for (const j of activeJours) {
          newEntries.push({ personnage_id: charId, instance: inst, jour: j, statut });
        }
      }
      setPrefs([...otherPrefs, ...newEntries]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg('');
    try {
      await api.savePreferences(prefs.map(p => ({
        personnage_id: p.personnage_id,
        instance: p.instance,
        jour: p.jour,
        statut: p.statut || 'present',
      })));
      setMsg('Préférences sauvegardées !');
    } catch (err) {
      setMsg('Erreur: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (chars.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Mes dispos</h1>
        <div className="card">
          <p className="empty-state">Crée d'abord un personnage dans l'onglet "Personnages".</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Mes dispos</h1>
      <p className="page-subtitle" style={{ textAlign: 'center', color: '#b0a080', marginBottom: 18, fontStyle: 'italic' }}>
        Coche les créneaux où tu <strong>aimerais</strong> raider dans un monde parfait. C'est théorique — ça aide les officiers à construire le planning réel.
      </p>

      <div className="week-legend" style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 16, fontSize: '0.85rem' }}>
        <span>⚔️ Présent</span>
        <span>❓ Tentative</span>
        <span>🚫 Absent</span>
        <span style={{ color: '#888' }}>Clic = changer le statut</span>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}

      {chars.map(char => {
        return (
        <div key={char.id} className="card week-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ClassIcon classe={char.classe} size={22} /> <span style={{ color: CLASS_COLORS[char.classe] }}>{char.nom}</span>
            <span className={`badge badge-${char.type.toLowerCase()}`}>{TYPE_ICONS[char.type]} {char.type}</span>
            <span className="char-detail">{char.classe} — {char.role}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button className="btn btn-sm btn-success" onClick={() => setAllForChar(char.id, 'present')} style={{ fontSize: 11, padding: '3px 8px' }}>
                ⚔️ Tout présent
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => setAllForChar(char.id, 'absent')} style={{ fontSize: 11, padding: '3px 8px' }}>
                🚫 Tout absent
              </button>
              <button className="btn btn-sm" onClick={() => setAllForChar(char.id, null)} style={{ fontSize: 11, padding: '3px 8px' }}>
                Effacer
              </button>
            </span>
          </h3>

          <div className="week-grid">
            <div className="week-header">
              <div className="week-cell week-label"></div>
              {activeJours.map(j => <div key={j} className="week-cell week-day">{j.slice(0, 3)}</div>)}
            </div>
            {ALL_INSTANCES.map(inst => {
              const needsStuff = STUFF_REQUIRED.includes(inst);
              const stuffStatus = needsStuff
                ? char.validations?.find(v => v.instance === inst)?.statut
                : null;
              const notValidated = needsStuff && stuffStatus !== 'valide';

              return (
                <div key={inst} className="week-row">
                  <div className="week-cell week-label">
                    {INSTANCE_ICONS[inst]} {inst}
                    {notValidated && <span className="stuff-warn" title={`Stuff ${stuffStatus === 'refuse' ? 'refusé' : 'en attente de validation'}`}> ⚠️</span>}
                  </div>
                  {activeJours.map(j => {
                    const statut = prefMap[getKey(char.id, inst, j)] || null;
                    const display = statut ? STATUT_DISPLAY[statut] : null;
                    return (
                      <div
                        key={j}
                        className={`week-cell week-slot ${statut ? `week-${statut}` : ''}`}
                        onClick={() => cycleStatus(char.id, inst, j)}
                        title={`${char.nom} — ${inst} — ${j}${display ? ` — ${display.label}` : ''}`}
                      >
                        {display ? display.icon : ''}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}

      <div className="form-actions sticky-save">
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? 'Sauvegarde...' : 'Sauvegarder mes préférences'}
        </button>
      </div>
    </div>
  );
}
