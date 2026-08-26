import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ClassIcon, TYPE_ICONS, INSTANCE_ICONS, CLASS_ICON_URLS } from '../wowIcons.jsx';

const ROLE_ICONS = { Tank: '🛡️', Heal: '💚', DPS: '⚔️' };

const JOURS_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const CLASS_COLORS = {
  Guerrier: '#C79C6E', Chasseur: '#ABD473', Voleur: '#FFF569',
  'Prêtre': '#FFFFFF', Chaman: '#0070DE', Mage: '#69CCF0', 'Démoniste': '#9482C9', Druide: '#FF7D0A',
};

export default function Profil() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [membres, setMembres] = useState([]);
  const [profil, setProfil] = useState(null);
  const [freq, setFreq] = useState(3);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');

  const selectedId = searchParams.get('id');

  useEffect(() => {
    api.getMembresPublic().then(setMembres);
  }, []);

  useEffect(() => {
    setProfil(null);
    if (selectedId) {
      api.profil(selectedId).then(data => { setProfil(data); setFreq(data.raids_par_semaine_max); });
    }
  }, [selectedId]);

  function selectMembre(id) {
    setSearchParams({ id });
  }

  async function saveFreq() {
    setSaving(true);
    setMsg('');
    try {
      await api.setFrequence(freq);
      setMsg('Fréquence sauvegardée !');
    } catch (err) {
      setMsg('Erreur: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredMembres = membres.filter(m => {
    const q = search.toLowerCase();
    if (!q) return true;
    if (m.main_nom) return m.main_nom.toLowerCase().includes(q);
    return 'anomalie'.includes(q);
  });

  return (
    <div className="page">
      <h1 className="page-title">Membres de la guilde</h1>

      <div className="profil-layout">
        {/* Liste des membres */}
        <div className="membres-panel">
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="🔍 Rechercher un main..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="membres-list">
            {filteredMembres.map(m => (
              <div
                key={m.id}
                className={`membre-item ${selectedId == m.id ? 'membre-selected' : ''}`}
                onClick={() => selectMembre(m.id)}
              >
                <div className="membre-main-info">
                  {m.main_classe ? (
                    <img src={CLASS_ICON_URLS[m.main_classe]} alt="" style={{ width: 22, height: 22, borderRadius: 3 }} />
                  ) : (
                    <span className="membre-anomaly-icon" title="Pas de Main">⚠️</span>
                  )}
                  <div>
                    {m.main_nom ? (
                      <div className="membre-pseudo" style={{ color: CLASS_COLORS[m.main_classe] }}>{m.main_nom}</div>
                    ) : (
                      <div className="membre-pseudo membre-anomaly">⚠️ Anomalie — pas de Main</div>
                    )}
                  </div>
                </div>
                <div className="membre-stats-mini">
                  <span>{m.nb_personnages} perso{m.nb_personnages > 1 ? 's' : ''}</span>
                  <span>{m.nb_inscriptions} inscr.</span>
                </div>
              </div>
            ))}
            {filteredMembres.length === 0 && <p className="empty-state">Aucun résultat</p>}
          </div>
        </div>

        {/* Détail du profil */}
        <div className="profil-detail">
          {!selectedId && <p className="empty-state">← Sélectionne un membre pour voir son profil</p>}
          {selectedId && !profil && <p>Chargement...</p>}
          {profil && <ProfilDetail profil={profil} freq={freq} setFreq={setFreq} saveFreq={saveFreq} saving={saving} msg={msg} />}
        </div>
      </div>
    </div>
  );
}

function ProfilDetail({ profil, freq, setFreq, saveFreq, saving, msg }) {
  const prefsByDay = {};
  profil.preferences.forEach(p => {
    if (!prefsByDay[p.jour]) prefsByDay[p.jour] = [];
    prefsByDay[p.jour].push(p);
  });

  const mainChar = profil.personnages.find(c => c.type === 'Main');

  return (
    <>
      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="card profil-header-card">
        <div className="profil-identity">
          {mainChar ? (
            <>
              <ClassIcon classe={mainChar.classe} size={32} />
              <h2 style={{ color: CLASS_COLORS[mainChar.classe] }}>{mainChar.nom}</h2>
            </>
          ) : (
            <h2 className="membre-anomaly">⚠️ Anomalie — pas de Main</h2>
          )}
          <span className={`badge badge-${profil.role}`}>{profil.role === 'admin' ? '🛡️ Admin' : profil.role === 'officier' ? '👑 Officier' : '⚔️ Membre'}</span>
        </div>
        <div className="profil-meta">
          <span>Inscrit le {new Date(profil.created_at).toLocaleDateString('fr-FR')}</span>
          <span>{profil.personnages.length} personnage{profil.personnages.length !== 1 ? 's' : ''}</span>
          <span>{profil.total_raids_semaine} inscription{profil.total_raids_semaine !== 1 ? 's' : ''}</span>
          <span>Max {profil.raids_par_semaine_max} raids/sem.</span>
        </div>
      </div>


      <div className="card">
        <h2>Personnages</h2>
        <div className="profil-chars">
          {profil.personnages.map(c => (
            <div key={c.id} className="profil-char">
              <div className="profil-char-header">
                <ClassIcon classe={c.classe} size={28} />
                <span className="char-name" style={{ color: CLASS_COLORS[c.classe] }}>{c.nom}</span>
                <span className={`badge badge-${c.type.toLowerCase()}`}>{TYPE_ICONS[c.type]} {c.type}</span>
              </div>
              <div className="profil-char-details">
                <span>{c.classe} — {ROLE_ICONS[c.role]} {c.role}</span>
              </div>
              <div className="profil-char-tags">
                {c.acces?.map(a => (
                  <span key={a.instance} className={`tag ${a.debloque ? 'tag-ok' : 'tag-locked'}`}>
                    {a.instance} {a.debloque ? '✓' : '✗'}
                  </span>
                ))}
                {c.validations?.filter(v => v.instance).map(v => (
                  <span key={v.instance} className={`tag tag-${v.statut}`}>
                    {v.instance}: {v.statut === 'valide' ? '✓' : v.statut === 'refuse' ? '✗' : '⏳'}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {profil.personnages.length === 0 && <p className="empty-state">Aucun personnage</p>}
        </div>
      </div>

      <div className="card">
        <h2>Planning de la semaine</h2>
        {JOURS_ORDER.map(jour => {
          const dayPrefs = prefsByDay[jour];
          if (!dayPrefs) return null;
          return (
            <div key={jour} className="profil-day">
              <h3 className="profil-day-title">{jour}</h3>
              <div className="profil-day-raids">
                {dayPrefs.map((p, i) => (
                  <div key={i} className="profil-raid-entry">
                    <span className="profil-raid-instance">{INSTANCE_ICONS[p.instance]} {p.instance}</span>
                    <span className="profil-raid-char" style={{ color: CLASS_COLORS[p.classe] }}>
                      <ClassIcon classe={p.classe} size={16} /> {p.personnage_nom}
                      <span className={`badge badge-${p.type.toLowerCase()}`} style={{ marginLeft: 6 }}>{p.type}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {profil.preferences.length === 0 && <p className="empty-state">Aucune préférence enregistrée</p>}
      </div>
    </>
  );
}
