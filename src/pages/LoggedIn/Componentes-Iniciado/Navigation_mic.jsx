// src/pages/LoggedIn/Componentes-Iniciado/Navigation_mic.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './NavigationMic.css'; // Crea este archivo para estilos
import { useNavigationContext } from '../../../context/NavigationContext'; // Ajusta ruta

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const NavigationMic = () => {
  const {
    isNavMicListening: contextIsListening,
    processNavCommand,
    startNavListening,
    stopNavListening
   } = useNavigationContext();

  const [isListeningLocal, setIsListeningLocal] = useState(false);
  const [statusMessageLocal, setStatusMessageLocal] = useState('Navegar (Espacio)'); // Mensaje corto para title
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const spacebarHeldRef = useRef(false);
  const commandToSendRef = useRef('');

  useEffect(() => { setIsListeningLocal(contextIsListening); }, [contextIsListening]);

  useEffect(() => {
    if (!SpeechRecognition) { setError("Voz no soportada."); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'es-ES';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      console.log("NavMic: onstart"); setIsListeningLocal(true); startNavListening();
      setStatusMessageLocal("Escuchando navegación..."); setError(null); commandToSendRef.current = '';
    };
    recognition.onresult = (event) => {
      const command = event.results[event.results.length - 1][0].transcript.trim();
      console.log("NavMic: onresult:", command); setStatusMessageLocal(`Detectado: "${command}"`);
      commandToSendRef.current = command;
    };
    recognition.onerror = (event) => {
      console.error("NavMic: onerror:", event.error); let errorMsg = `Error: ${event.error}`;
      if (event.error === 'not-allowed') { errorMsg = 'Permiso Mic. denegado.'; }
      else if (event.error === 'no-speech') { errorMsg = 'No se detectó voz.'; }
      setError(errorMsg); setStatusMessageLocal('Error Mic.'); setIsListeningLocal(false); stopNavListening(); commandToSendRef.current = '';
    };
    recognition.onend = () => {
      console.log("NavMic: onend"); setIsListeningLocal(false); stopNavListening();
      const finalCommand = commandToSendRef.current;
      if (processNavCommand && finalCommand) { processNavCommand(finalCommand); }
      else if (processNavCommand && !error) { processNavCommand(''); }
      if (!error) { setStatusMessageLocal('Navegar (Espacio)'); }
      commandToSendRef.current = '';
    };
    return () => { if (recognitionRef.current) { try {recognitionRef.current.abort();}catch(e){}} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processNavCommand, startNavListening, stopNavListening, error]);

  const handleKeyDown = useCallback((event) => {
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;
    if (event.code === 'Space' && !isListeningLocal && !spacebarHeldRef.current) {
      event.preventDefault(); spacebarHeldRef.current = true;
      if (recognitionRef.current) {
        try { console.log("NavMic: Iniciando por Espacio..."); recognitionRef.current.start(); }
        catch (err) { console.error("NavMic: Error al iniciar:", err); setError("No se pudo iniciar Mic."); spacebarHeldRef.current = false;}
      }
    }
  }, [isListeningLocal]);

  const handleKeyUp = useCallback((event) => {
    if (event.code === 'Space') { spacebarHeldRef.current = false; }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  if (!SpeechRecognition && !error) { return <div className="navigation-mic-error" title="Voz no soportada">🚫</div>; }

  return (
    <div className={`navigation-mic ${isListeningLocal ? 'listening' : ''} ${error ? 'mic-error' : ''}`} title={error || statusMessageLocal}>
      <span className="mic-icon">🎙️</span> {/* Cambiado a un emoji más estándar */}
    </div>
  );
};
export default NavigationMic;