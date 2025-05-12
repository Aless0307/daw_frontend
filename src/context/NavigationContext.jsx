// src/context/NavigationContext.jsx
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Ajusta ruta si es diferente

const NavigationMicContext = createContext(null);

export const useNavigationContext = () => {
  const context = useContext(NavigationMicContext);
  if (!context) {
    throw new Error('useNavigationContext debe ser usado dentro de un NavigationProvider');
  }
  return context;
};

export const NavigationProvider = ({ children }) => {
  const [isNavMicListening, setIsNavMicListening] = useState(false);
  const [navStatusMessage, setNavStatusMessage] = useState('Navegación por voz lista (Espacio).');
  const [lastNavCommand, setLastNavCommand] = useState(null);

  const navigate = useNavigate();
  const { logout } = useAuth();

  const startNavListening = useCallback(() => {
    console.log("NavigationContext: startNavListening");
    setIsNavMicListening(true);
  }, []);

  const stopNavListening = useCallback(() => {
    console.log("NavigationContext: stopNavListening");
    setIsNavMicListening(false);
  }, []);

  const processNavCommand = useCallback((command) => {
    const lowerCommand = command?.toLowerCase().trim() || '';
    setLastNavCommand(lowerCommand);
    setIsNavMicListening(false); // Asumir que para de escuchar al procesar

    console.log("[NavigationContext] Procesando Comando de Navegación:", lowerCommand);

    if (!lowerCommand) {
        setNavStatusMessage("No se recibió comando para navegar.");
        return;
    }

    if (lowerCommand.includes('lógica') || lowerCommand.includes('lógico')) {
      setNavStatusMessage("Navegando a Lógica..."); navigate('/logica');
    } else if (lowerCommand.includes('home') || lowerCommand.includes('inicio') || lowerCommand.includes('casa')) {
      setNavStatusMessage("Navegando a Inicio..."); navigate('/home');
    } else if (lowerCommand.includes('calendario')) {
       setNavStatusMessage("Navegando a Calendario..."); navigate('/calendar');
    } else if (lowerCommand.includes('proyectos')) {
        setNavStatusMessage("Navegando a Proyectos..."); navigate('/projects');
    } else if (lowerCommand.includes('ajustes') || lowerCommand.includes('configuración')) {
        setNavStatusMessage("Navegando a Ajustes..."); navigate('/settings');
    } else if (lowerCommand.includes('ayuda')) {
        setNavStatusMessage("Navegando a Ayuda..."); navigate('/help');
    } else if (lowerCommand.includes('contacto')) {
         setNavStatusMessage("Navegando a Contacto..."); navigate('/contact');
    } else if (lowerCommand.includes('acerca')) {
          setNavStatusMessage("Navegando a Acerca de..."); navigate('/acerca');
    } else if (lowerCommand.includes('salir') || lowerCommand.includes('cerrar sesión')) {
      setNavStatusMessage("Cerrando sesión...");
      if (typeof logout === 'function') { logout(); }
      else { console.error("NavigationContext: logout no disponible."); setNavStatusMessage("Error al cerrar sesión."); }
    } else {
      console.log("Comando de navegación no reconocido:", lowerCommand);
      setNavStatusMessage(`Comando "${lowerCommand}" no reconocido.`);
      const timer = setTimeout(() => setNavStatusMessage('Navegación por voz lista (Espacio).'), 3000);
      // Considerar limpiar timer si otro comando llega antes
    }
  }, [navigate, logout]);

  const value = {
    isNavMicListening, navStatusMessage, lastNavCommand,
    startNavListening, stopNavListening, processNavCommand
  };

  return (
    <NavigationMicContext.Provider value={value}>
      {children}
    </NavigationMicContext.Provider>
  );
};