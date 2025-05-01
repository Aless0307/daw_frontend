import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './SideBar.css';

const SideBar = () => {
  const [expanded, setExpanded] = useState(false);
  
  // Navigation items - you can modify these and their routes later
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Profile', path: '/profile', icon: '👤' },
    { name: 'Projects', path: '/projects', icon: '📁' },
    { name: 'Calendar', path: '/calendar', icon: '📅' },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
    { name: 'Help', path: '/help', icon: '❓' },
  ];

  return (
    <nav 
      className={`sidebar ${expanded ? 'expanded' : 'collapsed'}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="sidebar-header">
        {expanded ? <h3>Applessandro</h3> : <h3>AN</h3>}
      </div>
      <div className="sidebar-menu">
        <ul>
          {navItems.map((item, index) => (
            <li key={index}>
              <NavLink 
                to={item.path}
                className={({ isActive }) => isActive ? "active" : ""}
                title={item.name}
              >
                <span className="icon">{item.icon}</span>
                <span className="text">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      <div className="sidebar-footer">
        <NavLink to="/logout" className="logout-btn" title="Logout">
          <span className="icon">🚪</span>
          <span className="text">Logout</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default SideBar;
