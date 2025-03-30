import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [timeString, setTimeString] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
  };

  const navItems = [
    { path: '/home', label: 'INICIO' },
    { path: '/acerca', label: 'ACERCA' },
    { path: '/contact', label: 'CONTACTO' }
  ];

  return (
    <nav className="relative bg-slate-900/90 backdrop-blur-md border-b border-white/10">
      {/* Línea superior con efecto de escaneo */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-scan-vertical"></div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo y nombre del sistema */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute -inset-1 bg-cyan-500/20 rounded-full blur animate-pulse"></div>
              <div className="relative w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">SB</span>
              </div>
            </div>
            <div>
              <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 font-mono font-bold text-xl">
                SISTEMA BIOMÉTRICO
              </h1>
              <p className="text-[10px] text-cyan-500 font-mono">v2.0.4 [BETA]</p>
            </div>
          </div>

          {/* Estado del sistema y hora */}
          <div className="hidden md:flex items-center space-x-6 text-sm font-mono">
            <div className="flex items-center space-x-2 text-cyan-400">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></span>
              <span>{timeString}</span>
            </div>
            <div className="text-purple-400">
              ESTADO: OPERATIVO
            </div>
          </div>

          {/* Navegación principal */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg font-mono text-sm transition-all duration-300 ${
                  location.pathname === item.path
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg font-mono text-sm transition-all duration-300 text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-red-500/30"
            >
              CERRAR SESIÓN
            </button>
          </div>

          {/* Botón de menú móvil */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden relative group p-2"
          >
            <div className="w-6 h-px bg-cyan-400 mb-1 transition-all"></div>
            <div className="w-6 h-px bg-cyan-400 mb-1 transition-all"></div>
            <div className="w-6 h-px bg-cyan-400 transition-all"></div>
          </button>
        </div>

        {/* Menú móvil */}
        {isMenuOpen && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-t border-white/10">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-3 py-2 rounded-lg font-mono text-sm transition-all duration-300 ${
                    location.pathname === item.path
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg font-mono text-sm transition-all duration-300 text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-red-500/30"
              >
                CERRAR SESIÓN
              </button>
            </div>
            <div className="px-4 py-3 border-t border-white/10">
              <div className="flex items-center justify-between text-sm font-mono">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></span>
                  <span>{timeString}</span>
                </div>
                <div className="text-purple-400">
                  ESTADO: OPERATIVO
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
