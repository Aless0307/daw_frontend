// src/App.jsx
import React, { useState, useCallback } from 'react'; // Añadir useState, useCallback
import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationProvider } from './context/NavigationContext'; // <-- 1. IMPORTAR PROVIDER (ajusta ruta)
import Login from './pages/Login';
import AccessibleLogin from './pages/AccessibleLogin';
import Acerca from './pages/Acerca';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Contact from './pages/Contact';
import ProtectedRoute from './components/ProtectedRoute';

// Importar componentes de usuario logueado
import Home from './pages/LoggedIn/Home';
// Asegúrate de que la importación sea nombrada si el archivo usa 'export const'
import { LogicSectionPage } from './pages/LoggedIn/Logica'; // <-- 2. IMPORTAR PAGINA LOGICA (ajusta ruta)
// Importar Sidebar aquí si AppLayout lo renderiza directamente
import SideBar from './pages/LoggedIn/Componentes-Iniciado/SideBar'; // <-- 3. IMPORTAR SIDEBAR (ajusta ruta)


// Componente Layout Principal
const AppLayout = () => {
  const { user } = useAuth();

  // --- 4. Añadir estado y handler para Sidebar ---
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const handleSidebarToggle = useCallback((expanded) => {
     setIsSidebarExpanded(expanded);
  }, []); // useCallback para estabilidad de la prop

  // Calcular padding si es necesario (o dejar que SideBar maneje su ancho)
  // const sidebarWidth = isSidebarExpanded ? 250 : 60; // Ejemplo
  // const mainContentPaddingLeft = user ? sidebarWidth : 0; // Solo si hay usuario/sidebar

  return (
    // Contenedor flex principal para toda la altura
    <div className="flex flex-col min-h-screen">
      {/* Navbar se muestra si hay usuario */}

      {/* Contenedor flex para Sidebar y Contenido principal */}
      <div className="flex flex-1"> {/* Asegura que ocupe el espacio vertical */}
        {/* --- 5. Renderizar Sidebar Condicionalmente --- */}


        {/* Contenido Principal */}
        <main
          className="flex-grow overflow-x-auto" // Permite scroll si el contenido es muy ancho
          // Opcional: Aplicar padding basado en sidebar si es necesario por tu CSS
          // style={{ paddingLeft: `${mainContentPaddingLeft}px`, transition: 'padding-left 0.3s ease' }}
        >
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/" element={<AccessibleLogin />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/home" />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/acerca" element={<Acerca />} />

            {/* Rutas Protegidas */}
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            {/* Asegúrate que '/logica' también esté protegida si es necesario */}
            <Route path="/logica" element={<ProtectedRoute><LogicSectionPage /></ProtectedRoute>} />

            {/* Redirección por defecto */}
            <Route path="*" element={<Navigate to={user ? "/home" : "/"} />} />
          </Routes>
        </main>
      </div>

      {/* Footer se muestra si hay usuario */}
      {user && <Footer />}
    </div>
  );
};

// Componente Principal de la Aplicación
const App = () => {
  return (
    // 1. AuthProvider (más externo)
    <AuthProvider>
      {/* 2. HashRouter */}
      <HashRouter>
        {/* --- 6. Envolver con NavigationProvider --- */}
        <NavigationProvider>
          {/* 3. AppLayout (o tu estructura principal) */}
          <AppLayout />
        </NavigationProvider>
        {/* --- Fin Wrapper --- */}
      </HashRouter>
    </AuthProvider>
  );
};

export default App;