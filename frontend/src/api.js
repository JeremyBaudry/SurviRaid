const API = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

function getToken() {
  return localStorage.getItem('surviraid_token');
}

export function setAuth(token, user) {
  localStorage.setItem('surviraid_token', token);
  localStorage.setItem('surviraid_user', JSON.stringify(user));
}

export function getUser() {
  const u = localStorage.getItem('surviraid_user');
  return u ? JSON.parse(u) : null;
}

export function logout() {
  localStorage.removeItem('surviraid_token');
  localStorage.removeItem('surviraid_user');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

export const api = {
  register: (pseudo, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ pseudo, password }) }),
  login: (pseudo, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ pseudo, password }) }),
  me: () => request('/auth/me'),
  profil: (id) => request(id ? `/auth/profil/${id}` : '/auth/profil'),
  getMembresPublic: () => request('/auth/membres'),
  setFrequence: (raids_par_semaine_max) => request('/auth/frequence', { method: 'PUT', body: JSON.stringify({ raids_par_semaine_max }) }),

  getClasses: () => request('/characters/classes'),
  getCharacters: () => request('/characters'),
  createCharacter: (data) => request('/characters', { method: 'POST', body: JSON.stringify(data) }),
  updateCharacter: (id, data) => request(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCharacter: (id) => request(`/characters/${id}`, { method: 'DELETE' }),

  getPreferences: () => request('/preferences'),
  savePreferences: (preferences) => request('/preferences', { method: 'PUT', body: JSON.stringify({ preferences }) }),
  getJoursActifs: () => request('/preferences/jours-actifs'),

  getOverview: () => request('/overview'),

  getMembres: () => request('/admin/membres'),
  setRole: (id, role) => request(`/admin/membres/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  deleteMembre: (id) => request(`/admin/membres/${id}`, { method: 'DELETE' }),
  getValidations: () => request('/admin/validations'),
  setValidation: (id, statut) => request(`/admin/validations/${id}`, { method: 'PUT', body: JSON.stringify({ statut }) }),
  setJourActif: (jour, actif) => request(`/admin/jours/${jour}`, { method: 'PUT', body: JSON.stringify({ actif }) }),
};
