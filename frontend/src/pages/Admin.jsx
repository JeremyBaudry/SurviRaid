import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Admin({ user }) {
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('validations');
  const [membres, setMembres] = useState([]);
  const [validations, setValidations] = useState([]);
  const [jours, setJours] = useState([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [v, j] = await Promise.all([api.getValidations(), api.getJoursActifs()]);
    setValidations(v);
    setJours(j);
    if (isAdmin) {
      const m = await api.getMembres();
      setMembres(m);
    }
  }

  async function toggleJour(jour, actif) {
    await api.setJourActif(jour, actif);
    setJours(jours.map(j => j.jour === jour ? { ...j, actif: actif ? 1 : 0 } : j));
  }

  async function changeRole(id, role) {
    await api.setRole(id, role);
    loadAll();
  }

  async function deleteMembre(id, pseudo) {
    if (!confirm(`Supprimer ${pseudo} et tous ses personnages ?`)) return;
    await api.deleteMembre(id);
    loadAll();
  }

  async function changeValidation(id, statut) {
    await api.setValidation(id, statut);
    loadAll();
  }

  return (
    <div className="page">
      <h1 className="page-title">Administration</h1>

      <div className="admin-tabs">
        <button className={`tab ${tab === 'validations' ? 'tab-active' : ''}`} onClick={() => setTab('validations')}>Validations Stuff</button>
        {isAdmin && <button className={`tab ${tab === 'membres' ? 'tab-active' : ''}`} onClick={() => setTab('membres')}>Membres</button>}
      </div>

      {tab === 'validations' && (
        <div className="card">
          <h2>Validations de stuff (AQ40 / Naxx)</h2>
          <div className="table-wrap">
            <table className="wow-table">
              <thead>
                <tr>
                  <th>Joueur</th>
                  <th>Personnage</th>
                  <th>Classe / Rôle</th>
                  <th>Instance</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {validations.map(v => (
                  <tr key={v.id}>
                    <td>{v.joueur_pseudo}</td>
                    <td>{v.personnage_nom}</td>
                    <td>{v.classe} — {v.personnage_role}</td>
                    <td>{v.instance}</td>
                    <td>
                      <span className={`tag tag-${v.statut}`}>
                        {v.statut === 'valide' ? '✓ Validé' : v.statut === 'refuse' ? '✗ Refusé' : '⏳ En attente'}
                      </span>
                    </td>
                    <td className="action-cell">
                      <button className="btn btn-sm btn-primary" onClick={() => changeValidation(v.id, 'valide')}>Valider</button>
                      <button className="btn btn-sm btn-danger" onClick={() => changeValidation(v.id, 'refuse')}>Refuser</button>
                      <button className="btn btn-sm" onClick={() => changeValidation(v.id, 'en_attente')}>Reset</button>
                    </td>
                  </tr>
                ))}
                {validations.length === 0 && <tr><td colSpan={6} className="empty-state">Aucune validation en attente</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'membres' && (
        <div className="card">
          <h2>Membres de la guilde</h2>
          <div className="table-wrap">
            <table className="wow-table">
              <thead>
                <tr>
                  <th>Pseudo</th>
                  <th>Rôle</th>
                  <th>Personnages</th>
                  <th>Inscrit le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {membres.map(m => (
                  <tr key={m.id}>
                    <td>{m.pseudo}</td>
                    <td><span className={`badge badge-${m.role}`}>{m.role === 'admin' ? '🛡️ Admin' : m.role === 'officier' ? '👑 Officier' : '⚔️ Membre'}</span></td>
                    <td>{m.nb_personnages}</td>
                    <td>{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="action-cell">
                      <select
                        className="role-select"
                        value={m.role}
                        onChange={e => changeRole(m.id, e.target.value)}
                      >
                        <option value="membre">Membre</option>
                        <option value="officier">Officier</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteMembre(m.id, m.pseudo)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
