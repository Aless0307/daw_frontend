// src/pages/LoggedIn/Componentes-Iniciado/SideBar.jsx (o donde esté)
import React from 'react';
import { NavLink } from 'react-router-dom';
import './SideBar.css';
import NavigationMic from './Navigation_mic'; // <-- CORRECCIÓN: Ruta relativa al mismo directorio

// Recibe props del padre (AppLayout)
// Ya no necesita 'logout'
const SideBar = ({ isExpanded, onToggleExpansion, user }) => {

  // Items de Navegación (igual que antes)
  const navItems = [
    { name: 'Lógica', path: '/logica', icon: '🧠' },
    { name: 'Home', path: '/home', icon: '🏠' },
    { name: 'Projects', path: '/projects', icon: '📁' }, // Asegúrate que estas rutas existan en App.jsx
    { name: 'Calendar', path: '/calendar', icon: '📅' },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
    { name: 'Help', path: '/help', icon: '❓' },
  ];

  return (
    <nav
      className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}
      onMouseEnter={() => onToggleExpansion(true)}
      onMouseLeave={() => onToggleExpansion(false)}
    >
      <div className="sidebar-header">
        {isExpanded ? <h3>Applessandro</h3> : <h3>Ale</h3>}
      </div>
      <div className="sidebar-menu">
        <ul>
          {/* Mapeo de items de navegación (sin cambios) */}
          {navItems.map((item, index) => (
            <li key={index}>
              <NavLink
                to={item.path}
                className={({ isActive }) => isActive ? "active" : ""}
                title={item.name}
              >
                <span className="icon">{item.icon}</span>
                {isExpanded && <span className="text">{item.name}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer de la Sidebar */}
      <div className="sidebar-footer">

          {/* --- 2. AÑADIR MICRÓFONO DE NAVEGACIÓN --- */}
          <div className="navigation-mic-container" title="Navegación por Voz (Presiona Espacio)">
              <NavigationMic />
              {/* Mostrar texto solo si está expandido */}
              {isExpanded && <span className="text" style={{marginLeft: '10px', fontSize: '0.8em', color: '#ccc'}}>Navegar (Espacio)</span>}
          </div>
          {/* --- FIN MICRÓFONO --- */}


          {/* Botón/Enlace Logout (ya no usa la prop 'logout') */}
          {/* Puedes dejarlo como un NavLink a una ruta que maneje el logout,
              o simplemente como un botón visual si SOLO se usa la voz para logout */}
          <NavLink to="/" onClick={(e) => {
                // Opcional: Prevenir navegación y llamar a logout del contexto aquí si quieres doble funcionalidad
                // e.preventDefault();
                // Aquí necesitarías acceso a logout, sería mejor manejarlo solo por voz via context
                console.log("Botón visual de logout presionado (acción principal por voz).");
             }} className="logout-btn" title="Logout (Usar Voz)">
             <span className="icon">🚪</span>
             {isExpanded && <span className="text">Logout</span>}
           </NavLink>

      </div>
    </nav>
  );
};

export default SideBar;