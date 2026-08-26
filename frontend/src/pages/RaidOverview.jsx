import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { INSTANCE_ICONS, ClassIcon, CLASS_ICON_URLS } from '../wowIcons.jsx';

const JOURS_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const ALL_INSTANCES = ['Naxx', 'AQ40', 'BWL', 'ONY', 'MC'];
const RAID_SIZE = { Naxx: 40, AQ40: 40, BWL: 40, ONY: 40, MC: 40 };

const CLASS_COLORS = {
  Guerrier: '#C79C6E', Paladin: '#F58CBA', Chasseur: '#ABD473', Voleur: '#FFF569',
  'Prêtre': '#FFFFFF', Chaman: '#0070DE', Mage: '#69CCF0', 'Démoniste': '#9482C9', Druide: '#FF7D0A',
};

function splitByType(players) {
  return {
    mains: players.filter(p => p.type === 'Main'),
    rerolls: players.filter(p => p.type === 'Reroll'),
  };
}

const PREF_RANK = { present: 3, tentative: 2, absent: 1 };

function prefRank(statut) {
  return PREF_RANK[statut] ?? 2;
}

function mergeInscription(existing, incoming) {
  if (!existing) return incoming;
  if (prefRank(incoming.prefStatut) > prefRank(existing.prefStatut)) {
    return { ...existing, ...incoming, prefStatut: incoming.prefStatut };
  }
  if (prefRank(incoming.prefStatut) < prefRank(existing.prefStatut)) {
    return existing;
  }
  if (incoming.type === 'Main' && existing.type !== 'Main') {
    return { ...existing, ...incoming };
  }
  return existing;
}

function getInscriptionsForRaid(inst, raidMap, sortedJours) {
  const all = [];
  sortedJours.forEach(jour => {
    const raid = raidMap[`${jour}|${inst}`];
    if (raid) all.push(...raid.inscrits);
  });
  return all;
}

function getUniqueCharactersForRaid(allInscriptions) {
  const byNom = new Map();
  allInscriptions.forEach(p => {
    byNom.set(p.nom, mergeInscription(byNom.get(p.nom), p));
  });
  return Array.from(byNom.values());
}

/** Roster total : 1 entrée par joueur (main), même si inscrit en reroll ou absent certains jours */
function getRosterMains(allInscriptions) {
  const byJoueur = new Map();
  allInscriptions.forEach(p => {
    const key = p.joueurId ?? p.mainNom ?? p.nom;
    byJoueur.set(key, mergeInscription(byJoueur.get(key), p));
  });
  return Array.from(byJoueur.values())
    .filter(p => p.prefStatut !== 'absent')
    .map(p => ({
      ...p,
      nom: p.type === 'Main' ? p.nom : (p.mainNom || p.nom),
      classe: p.type === 'Main' ? p.classe : (p.mainClasse || p.classe),
      role: p.type === 'Main' ? p.role : (p.mainRole || p.role),
      type: 'Main',
    }));
}

function getRerollSignups(allInscriptions) {
  const byNom = new Map();
  allInscriptions.forEach(p => {
    if (p.type !== 'Reroll') return;
    byNom.set(p.nom, mergeInscription(byNom.get(p.nom), p));
  });
  return Array.from(byNom.values()).filter(p => p.prefStatut !== 'absent');
}

function roleStats(players) {
  return {
    tanks: players.filter(p => p.role === 'Tank'),
    heals: players.filter(p => p.role === 'Heal'),
    dps: players.filter(p => p.role === 'DPS'),
  };
}

function countClasses(players) {
  const counts = {};
  players.forEach(p => { counts[p.classe] = (counts[p.classe] || 0) + 1; });
  return counts;
}

export default function RaidOverview() {
  const [data, setData] = useState({ raids: [], jours_actifs: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [expandedDays, setExpandedDays] = useState({});

  const refresh = useCallback(() => {
    setLoading(true);
    api.getOverview().then(d => { setData(d); setLoading(false); });
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const activeJours = data.jours_actifs.filter(j => j.actif).map(j => j.jour);
  const sortedJours = JOURS_ORDER.filter(j => activeJours.includes(j));

  const raidMap = {};
  data.raids.forEach(r => { raidMap[`${r.jour}|${r.instance}`] = r; });

  function toggleExpand(inst) {
    setExpanded(prev => ({ ...prev, [inst]: !prev[inst] }));
  }

  function toggleExpandDay(inst, jour) {
    const key = `${inst}|${jour}`;
    setExpandedDays(prev => ({ ...prev, [key]: !prev[key] }));
  }


  return (
    <div className="page">
      <div className="page-title-row">
        <h1 className="page-title">Vue Remplissage des Raids</h1>
        <button className="btn btn-sm" onClick={refresh} disabled={loading}>
          {loading ? '...' : '🔄 Rafraîchir'}
        </button>
      </div>

      {/* Stats générales */}
      {data.stats && data.stats.total_membres > 0 && (
        <div className="card overview-summary">
          <h2>Résumé de la guilde</h2>
          <div className="summary-grid">
            <div className="summary-box">
              <span className="summary-box-value">{data.stats.total_membres}</span>
              <span className="summary-box-label">Membres</span>
            </div>
            <div className="summary-box">
              <span className="summary-box-value">{data.stats.membres_actifs}</span>
              <span className="summary-box-label">Ont des préférences</span>
            </div>
            <div className="summary-box">
              <span className="summary-box-value summary-warn">{data.stats.membres_sans_prefs}</span>
              <span className="summary-box-label">Sans préférences</span>
            </div>
            <div className="summary-box">
              <span className="summary-box-value">{data.stats.total_membres > 0 ? (data.stats.total_rerolls / data.stats.total_membres).toFixed(1) : 0}</span>
              <span className="summary-box-label">Moy. rerolls / membre</span>
            </div>
            <div className="summary-box summary-box-highlight">
              <span className="summary-box-value">{data.stats.freq_moyenne}</span>
              <span className="summary-box-label">Moy. raids/sem. souhaitée</span>
            </div>
          </div>
        </div>
      )}

      {ALL_INSTANCES.map(inst => {
        const isOpen = !!expanded[inst];
        const allInscriptions = getInscriptionsForRaid(inst, raidMap, sortedJours);
        const uniqueCharacters = getUniqueCharactersForRaid(allInscriptions);
        const mains = getRosterMains(allInscriptions);
        const rerolls = getRerollSignups(allInscriptions);
        const mainRoles = roleStats(mains);
        const maxSize = RAID_SIZE[inst];

        const bestDay = sortedJours.reduce((best, jour) => {
          const inscrits = raidMap[`${jour}|${inst}`]?.inscrits || [];
          const mainCount = inscrits.filter(i => i.type === 'Main' && i.prefStatut !== 'absent').length;
          return mainCount > (best.count || 0) ? { jour, count: mainCount } : best;
        }, { jour: null, count: 0 });

        const bestMainsForRoles = bestDay.jour
          ? (raidMap[`${bestDay.jour}|${inst}`]?.inscrits || []).filter(i => i.type === 'Main' && i.prefStatut !== 'absent')
          : [];
        const bestMainRoles = roleStats(bestMainsForRoles);

        const dayCounts = sortedJours.map(jour => {
          const raid = raidMap[`${jour}|${inst}`];
          const count = raid ? (raid.inscrits || []).filter(p => p.type === 'Main' && p.prefStatut !== 'absent').length : 0;
          return { jour, count };
        });
        const maxDayCount = Math.max(...dayCounts.map(x => x.count), 0);
        const maxDayEntry = dayCounts.find(x => x.count === maxDayCount && maxDayCount > 0);

        return (
          <div key={inst} className="card raid-section">
            <div className="raid-section-header" onClick={() => toggleExpand(inst)}>
              <div className="raid-section-header-top">
                <div className="raid-section-title">
                  <span className="expand-icon">{isOpen ? '▼' : '▶'}</span>
                  <h2 className="raid-instance-name">{INSTANCE_ICONS[inst]} {inst}</h2>
                  <span className="raid-size-tag">{maxSize} joueurs</span>
                </div>
                <div className="raid-section-badges">
                  {rerolls.length > 0 && (
                    <span className="subtotal subtotal-reroll">Renforts: {rerolls.length}</span>
                  )}
                  {['AQ40', 'Naxx'].includes(inst) && (() => {
                    const toValidate = uniqueCharacters.filter(p => p.stuffStatut === 'en_attente').length;
                    return toValidate > 0 ? <span className="subtotal subtotal-warn">⚠️ {toValidate} à valider</span> : null;
                  })()}
                </div>
              </div>

              {sortedJours.length > 0 && (
                <div className="raid-day-summary-header">
                  <span className="raid-day-summary-label">Mains par jour</span>
                  <div className="summary-raid-day-counts">
                    {dayCounts.map(({ jour, count }) => (
                      <span key={jour} className="summary-raid-day-count" title={`${jour}: ${count} mains`}>
                        <span className="summary-day-label">{jour.slice(0, 3)}</span>
                        <span className="summary-day-pill">{count}</span>
                      </span>
                    ))}
                  </div>
                  {maxDayEntry && (
                    <span className="summary-raid-day-max">
                      <span className="text-dim">Max</span>
                      <span className="summary-day-pill">{maxDayEntry.jour.slice(0, 3)}</span>
                      <span className="summary-day-pill">{maxDayEntry.count}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {isOpen && (
              <div className="raid-section-body">
                <div className="raid-comp-layout">
                  <div className="raid-comp-headers">
                    <h3 className="raid-comp-group-title">Roster total (Mains)</h3>
                    <h3 className="raid-comp-group-title">Résumé du meilleur soir</h3>
                  </div>
                  <div className="raid-comp-grid-4">
                    <CompBox label="Total mains">
                      <span className="comp-pill comp-pill-lg">{mains.length}</span>
                    </CompBox>
                    <CompBox label="Rôles">
                      <RoleList roles={mainRoles} />
                    </CompBox>
                    <CompBox label={bestDay.jour || '—'}>
                      {bestDay.jour ? (
                        <div className="comp-inline">
                          <span className="comp-pill comp-pill-lg">{bestDay.count}</span>
                          <span className="comp-suffix">mains</span>
                        </div>
                      ) : <span className="text-dim">—</span>}
                    </CompBox>
                    <CompBox label="Rôles">
                      {bestDay.jour ? <RoleList roles={bestMainRoles} /> : <span className="text-dim">—</span>}
                    </CompBox>
                    <CompBox label="Classes" span={2}>
                      <ClassList classes={countClasses(mains)} emptyLabel="Aucun main" />
                    </CompBox>
                    <CompBox label="Classes" span={2}>
                      {bestDay.jour ? (
                        <ClassList classes={countClasses(bestMainsForRoles)} />
                      ) : <span className="text-dim">—</span>}
                    </CompBox>
                  </div>
                </div>

                {/* Renforts (Rerolls) */}
                {rerolls.length > 0 && (
                  <div className="raid-stats-panel reroll-panel">
                    <h3>🔄 Renforts disponibles (Rerolls)</h3>
                    <p className="hint">Ces joueurs ont un reroll disponible en renfort — non comptés dans le remplissage principal.</p>
                    <div className="reroll-list">
                      {rerolls.map((p, i) => {
                        const r = roleStats([p]);
                        const roleIcon = r.tanks.length ? '🛡️' : r.heals.length ? '💚' : '⚔️';
                        return (
                          <span key={i} className="player-tag player-reroll-tag" style={{ borderColor: CLASS_COLORS[p.classe], color: CLASS_COLORS[p.classe] }}>
                            {roleIcon} {p.nom} <span className="reroll-detail">(Reroll: {p.mainNom || '—'})</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Validation stuff pour AQ40/Naxx */}
                {['AQ40', 'Naxx'].includes(inst) && (() => {
                  const validated = uniqueCharacters.filter(p => p.stuffValide);
                  const pending = uniqueCharacters.filter(p => p.stuffStatut === 'en_attente');
                  const refused = uniqueCharacters.filter(p => p.stuffStatut === 'refuse');
                  if (pending.length === 0 && refused.length === 0) return null;
                  return (
                    <div className="raid-stats-panel stuff-panel">
                      <h3>⚠️ Validation Stuff</h3>
                      <div className="stuff-stats">
                        <span className="stuff-stat stuff-validated">✓ Validés: {validated.length}</span>
                        <span className="stuff-stat stuff-pending">⏳ En attente: {pending.length}</span>
                        {refused.length > 0 && <span className="stuff-stat stuff-refused">✗ Refusés: {refused.length}</span>}
                      </div>
                      {pending.length > 0 && (
                        <div className="stuff-players-warn">
                          <span className="stuff-warn-label">À valider:</span>
                          {pending.map((p, i) => (
                            <span key={i} className="player-tag player-not-validated" style={{ borderColor: CLASS_COLORS[p.classe], color: CLASS_COLORS[p.classe] }}>
                              {p.nom} ({p.classe}){p.type === 'Reroll' && <span className="reroll-detail"> (Reroll: {p.mainNom || '—'})</span>} ⏳
                            </span>
                          ))}
                        </div>
                      )}
                      {refused.length > 0 && (
                        <div className="stuff-players-warn">
                          <span className="stuff-warn-label">Refusés:</span>
                          {refused.map((p, i) => (
                            <span key={i} className="player-tag player-not-validated" style={{ borderColor: CLASS_COLORS[p.classe], color: CLASS_COLORS[p.classe] }}>
                              {p.nom} ({p.classe}){p.type === 'Reroll' && <span className="reroll-detail"> (Reroll: {p.mainNom || '—'})</span>} ❌
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Détail par jour */}
                <div className="raid-days-list">
                  <h3 className="raid-days-list-title">Détail par jour</h3>
                  {sortedJours.map(jour => {
                    const raid = raidMap[`${jour}|${inst}`];
                    const allInscrits = raid?.inscrits || [];
                    const absents = allInscrits.filter(i => i.prefStatut === 'absent');
                    const tentatives = allInscrits.filter(i => i.prefStatut === 'tentative');
                    const inscrits = allInscrits.filter(i => i.prefStatut !== 'absent' && i.prefStatut !== 'tentative');
                    const { mains: dayMains, rerolls: dayRerolls } = splitByType(inscrits);
                    const dayMainRoles = roleStats(dayMains);
                    const dayRerollRoles = roleStats(dayRerolls);
                    const dayKey = `${inst}|${jour}`;
                    const isDayOpen = !!expandedDays[dayKey];

                    return (
                      <div key={jour} className={`raid-day-expander ${dayMains.length > 0 ? 'raid-day-active' : ''}`}>
                        <div className="raid-day-expander-header" onClick={() => toggleExpandDay(inst, jour)}>
                          <span className="expand-icon">{isDayOpen ? '▼' : '▶'}</span>
                          <span className="raid-day-name">{jour}</span>
                          <span className="comp-pill">{dayMains.length}</span>
                          <span className="raid-day-meta">mains</span>
                          {!isDayOpen && dayMains.length > 0 && (
                            <span className="raid-day-mini-stats">
                              🛡️ {dayMainRoles.tanks.length} · 💚 {dayMainRoles.heals.length} · ⚔️ {dayMainRoles.dps.length}
                            </span>
                          )}
                        </div>
                        {isDayOpen && (
                          <div className="raid-day-expander-body">
                            {dayMains.length > 0 && (
                              <div className="raid-composition">
                                <RoleGroup label="🛡️ Tanks" count={dayMainRoles.tanks.length} players={dayMainRoles.tanks} />
                                <RoleGroup label="💚 Heals" count={dayMainRoles.heals.length} players={dayMainRoles.heals} />
                                <RoleGroup label="⚔️ DPS" count={dayMainRoles.dps.length} players={dayMainRoles.dps} />
                              </div>
                            )}
                            {dayRerolls.length > 0 && (
                              <div className="day-rerolls">
                                <span className="reroll-section-label">🔄 Renforts ({dayRerolls.length})</span>
                                <div className="raid-composition">
                                  <RoleGroup label="🛡️" count={dayRerollRoles.tanks.length} players={dayRerollRoles.tanks} isReroll />
                                  <RoleGroup label="💚" count={dayRerollRoles.heals.length} players={dayRerollRoles.heals} isReroll />
                                  <RoleGroup label="⚔️" count={dayRerollRoles.dps.length} players={dayRerollRoles.dps} isReroll />
                                </div>
                              </div>
                            )}
                            {tentatives.length > 0 && (
                              <div className="day-tentatives">
                                <span className="tentative-section-label">❓ Tentatives ({tentatives.length})</span>
                                <div className="absent-list">
                                  {tentatives.map((p, i) => (
                                    <span key={i} className="player-tag" style={{ borderColor: CLASS_COLORS[p.classe], color: CLASS_COLORS[p.classe], opacity: 0.65 }}>
                                      <img src={CLASS_ICON_URLS[p.classe]} alt="" style={{ width: 14, height: 14, borderRadius: 2, verticalAlign: 'middle', marginRight: 3 }} />
                                      {p.nom}
                                      {p.type === 'Reroll' && <span className="reroll-detail"> (Reroll: {p.mainNom || '—'})</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {absents.length > 0 && (
                              <div className="day-absents">
                                <span className="absent-section-label">🚫 Absents ({absents.length})</span>
                                <div className="absent-list">
                                  {absents.map((p, i) => (
                                    <span key={i} className="player-tag player-absent-tag" style={{ borderColor: CLASS_COLORS[p.classe], color: CLASS_COLORS[p.classe], opacity: 0.45 }}>
                                      <img src={CLASS_ICON_URLS[p.classe]} alt="" style={{ width: 14, height: 14, borderRadius: 2, verticalAlign: 'middle', marginRight: 3 }} />
                                      {p.nom}
                                      {p.type === 'Reroll' && <span className="reroll-detail"> (Reroll: {p.mainNom || '—'})</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {allInscrits.length === 0 && <span className="text-dim">Aucun inscrit</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompBox({ label, span, children }) {
  return (
    <div className={`comp-box ${span === 2 ? 'comp-box-span2' : ''}`}>
      <span className="comp-box-label">{label}</span>
      <div className="comp-box-content">{children}</div>
    </div>
  );
}

function RoleList({ roles }) {
  return (
    <div className="comp-chip-list">
      <span className="comp-chip">🛡️ Tanks <span className="comp-pill">{roles.tanks.length}</span></span>
      <span className="comp-chip">💚 Heals <span className="comp-pill">{roles.heals.length}</span></span>
      <span className="comp-chip">⚔️ DPS <span className="comp-pill">{roles.dps.length}</span></span>
    </div>
  );
}

function ClassList({ classes, emptyLabel }) {
  const entries = Object.entries(classes || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return emptyLabel ? <span className="text-dim">{emptyLabel}</span> : null;
  return (
    <div className="comp-chip-list">
      {entries.map(([cls, count]) => (
        <span key={cls} className="comp-chip" style={{ color: CLASS_COLORS[cls] }}>
          <img src={CLASS_ICON_URLS[cls]} alt="" className="comp-class-icon" title={cls} />
          {cls} <span className="comp-pill">{count}</span>
        </span>
      ))}
    </div>
  );
}

function RoleGroup({ label, count, players, isReroll }) {
  if (count === 0) return null;
  return (
    <div className="raid-role-group">
      <span className="role-label">{label} ({count})</span>
      {players.map((p, i) => (
        <span key={i} className={`player-tag ${p.stuffValide === false ? 'player-not-validated' : ''} ${isReroll ? 'player-reroll-tag' : ''}`} style={{ borderColor: CLASS_COLORS[p.classe], color: CLASS_COLORS[p.classe], opacity: p.prefStatut === 'absent' ? 0.4 : p.prefStatut === 'tentative' ? 0.7 : 1 }}>
          <img src={CLASS_ICON_URLS[p.classe]} alt="" style={{ width: 14, height: 14, borderRadius: 2, verticalAlign: 'middle', marginRight: 3 }} />
          {p.prefStatut === 'tentative' && <span title="Tentative" style={{ marginRight: 2 }}>❓</span>}
          {p.prefStatut === 'absent' && <span title="Absent" style={{ marginRight: 2 }}>🚫</span>}
          {p.nom}
          {isReroll && <span className="reroll-detail"> (Reroll: {p.mainNom || '—'})</span>}
          {p.stuffStatut === 'en_attente' && <span className="player-stuff">⏳</span>}
          {p.stuffStatut === 'refuse' && <span className="player-stuff player-stuff-refused">❌</span>}
        </span>
      ))}
    </div>
  );
}
