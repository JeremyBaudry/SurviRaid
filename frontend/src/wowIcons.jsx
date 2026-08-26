const WOW_ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/medium';

export const CLASS_ICON_URLS = {
  Guerrier: `${WOW_ICON_BASE}/class_warrior.jpg`,
  Chasseur: `${WOW_ICON_BASE}/class_hunter.jpg`,
  Voleur: `${WOW_ICON_BASE}/class_rogue.jpg`,
  'Prêtre': `${WOW_ICON_BASE}/class_priest.jpg`,
  Chaman: `${WOW_ICON_BASE}/class_shaman.jpg`,
  Mage: `${WOW_ICON_BASE}/class_mage.jpg`,
  'Démoniste': `${WOW_ICON_BASE}/class_warlock.jpg`,
  Druide: `${WOW_ICON_BASE}/class_druid.jpg`,
};

export const RACE_ICON_URLS = {
  Orc: `${WOW_ICON_BASE}/race_orc_male.jpg`,
  Tauren: `${WOW_ICON_BASE}/race_tauren_male.jpg`,
  Troll: `${WOW_ICON_BASE}/race_troll_male.jpg`,
  'Mort-vivant': `${WOW_ICON_BASE}/race_undead_male.jpg`,
};

export const ROLE_ICONS = {
  Tank: '🛡️',
  Heal: '💚',
  DPS: '⚔️',
};

export const INSTANCE_ICONS = {
  Naxx: '💀',
  AQ40: '🐛',
  BWL: '🐉',
  ONY: '🐲',
  MC: '🌋',
};

export const TYPE_ICONS = {
  Main: '⭐',
  Reroll: '🔄',
};

export const NAV_ICONS = {
  characters: '📋',
  week: '📅',
  raids: '⚔️',
  admin: '👑',
  logout: '🚪',
};

export function ClassIcon({ classe, size = 20 }) {
  const url = CLASS_ICON_URLS[classe];
  if (!url) return null;
  return <img src={url} alt={classe} title={classe} style={{ width: size, height: size, borderRadius: 4, verticalAlign: 'middle' }} />;
}

export function RaceIcon({ race, size = 20 }) {
  const url = RACE_ICON_URLS[race];
  if (!url) return null;
  return <img src={url} alt={race} title={race} style={{ width: size, height: size, borderRadius: 4, verticalAlign: 'middle' }} />;
}
