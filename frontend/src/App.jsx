import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { getUser, logout } from './api';
import Login from './pages/Login';
import Characters from './pages/Characters';
import WeekPlanner from './pages/WeekPlanner';
import RaidOverview from './pages/RaidOverview';
import Admin from './pages/Admin';
import Profil from './pages/Profil';
import { NAV_ICONS } from './wowIcons.jsx';
import './wow-theme.css';

function App() {
  const [user, setUser] = useState(getUser());

  function handleLogin(u) {
    setUser(u);
  }

  function handleLogout() {
    logout();
    setUser(null);
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <span className="nav-logo">🔱</span>
            <span className="nav-title">Les Survivants d'Azeroth</span>
          </div>
          <div className="nav-links">
            <NavLink to="/personnages">{NAV_ICONS.characters} Personnages</NavLink>
            <NavLink to="/semaine">{NAV_ICONS.week} Mes dispos</NavLink>
            <NavLink to="/raids">{NAV_ICONS.raids} Vue Raids</NavLink>
            <NavLink to="/profil">👤 Profil</NavLink>
            {(user.role === 'officier' || user.role === 'admin') && <NavLink to="/admin">{NAV_ICONS.admin} Admin</NavLink>}
          </div>
          <div className="nav-user">
            <span className="nav-pseudo">{user.pseudo}</span>
            <span className="nav-role">{user.role === 'admin' ? '🛡️ Admin' : user.role === 'officier' ? '👑 Officier' : '⚔️ Membre'}</span>
            <button onClick={handleLogout} className="btn btn-sm">{NAV_ICONS.logout} Déco</button>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/personnages" element={<Characters />} />
            <Route path="/semaine" element={<WeekPlanner />} />
            <Route path="/raids" element={<RaidOverview />} />
            <Route path="/profil" element={<Profil />} />
            {(user.role === 'officier' || user.role === 'admin') && <Route path="/admin" element={<Admin user={user} />} />}
            <Route path="*" element={<Navigate to="/personnages" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
