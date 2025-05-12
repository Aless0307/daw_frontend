// src/pages/LoggedIn/Componentes-Iniciado/Micro-enter.jsx
import React, { useState, useEffect, useRef } from 'react';
// import './Micro-enter.css'; // O el nombre de tu CSS

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const VoiceRecognition = ({
    onTextRecognized,
    onListeningChange,
    isLoadingResponse,
}) => {
  const [displayTranscript, setDisplayTranscript] = useState(''); // Único estado para mostrar transcripción
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const recognitionRef = useRef(null);
  const finalAccumulatedTranscriptRef = useRef(''); // Para acumular todas las partes finales

  // --- Refs para las props de callback (para estabilizar useEffect principal) ---
  const onTextRecognizedRef = useRef(onTextRecognized);
  const onListeningChangeRef = useRef(onListeningChange);

  useEffect(() => {
    onTextRecognizedRef.current = onTextRecognized;
  }, [onTextRecognized]);

  useEffect(() => {
    onListeningChangeRef.current = onListeningChange;
  }, [onListeningChange]);

  // --- Configuración Inicial y Limpieza del Reconocimiento ---
  useEffect(() => {
    if (!SpeechRecognition) {
      setVoiceError("Web Speech API no soportada.");
      return;
    }

    console.log(">>> VR [Continuous]: INICIALIZANDO instancia de SpeechRecognition (solo una vez por montaje)");
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      console.log(">>> VR [Continuous]: onstart - Micrófono activado.");
      setIsListening(true);
      if (onListeningChangeRef.current) onListeningChangeRef.current(true);
      setVoiceError('');
      // --- CORRECCIÓN: Limpiar estados de transcripción al iniciar ---
      setDisplayTranscript('');
      finalAccumulatedTranscriptRef.current = '';
      // --- FIN CORRECCIÓN ---
    };

    recognition.onresult = (event) => {
      // console.log(">>> VR [Continuous]: onresult - Recibiendo datos..."); // Puede ser muy verboso
      let interim_transcript_for_event = ''; // Lo que es intermedio en ESTE evento
      let final_transcript_for_event = '';   // Lo que es final en ESTE evento

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript_part = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final_transcript_for_event += transcript_part + ' ';
        } else {
          interim_transcript_for_event += transcript_part;
        }
      }

      // --- CORRECCIÓN: Acumular solo partes finales y construir display ---
      if (final_transcript_for_event) {
        finalAccumulatedTranscriptRef.current += final_transcript_for_event;
        console.log(">>> VR [Continuous]: Nuevo chunk final añadido. Acumulado final:", finalAccumulatedTranscriptRef.current);
      }
      // La vista siempre muestra todo lo final acumulado + lo intermedio actual de este evento
      setDisplayTranscript(finalAccumulatedTranscriptRef.current + interim_transcript_for_event);
      // --- FIN CORRECCIÓN ---
    };

    recognition.onerror = (event) => {
      console.error('>>> VR [Continuous]: onerror - Error:', event.error);
      let errorMsg = `Error de voz: ${event.error}`;
      if (event.error === 'not-allowed') { errorMsg = 'Permiso denegado.'; }
      else if (event.error === 'no-speech') { errorMsg = 'No se detectó voz.'; }
      else if (event.error === 'network') { errorMsg = 'Error de red.'; }
      else if (event.error === 'aborted') { errorMsg = 'Grabación cancelada.'; }
      setVoiceError(errorMsg);
      setIsListening(false);
      if (onListeningChangeRef.current) onListeningChangeRef.current(false);
      finalAccumulatedTranscriptRef.current = '';
      setDisplayTranscript('');
    };

    recognition.onend = () => {
      console.log(">>> VR [Continuous]: onend - Reconocimiento finalizado.");
      setIsListening(false);
      if (onListeningChangeRef.current) onListeningChangeRef.current(false);
      setDisplayTranscript(finalAccumulatedTranscriptRef.current.trim()); // Mostrar solo el final acumulado

      const finalText = finalAccumulatedTranscriptRef.current.trim();
      if (onTextRecognizedRef.current) {
           console.log(">>> VR [Continuous]: Enviando texto final acumulado desde onend:", finalText);
           onTextRecognizedRef.current(finalText);
      }
      // Considerar si limpiar finalAccumulatedTranscriptRef aquí o en onstart. Onstart es mejor.
    };

    return () => {
      console.log('>>> VR [Continuous]: Limpiando instancia SpeechRecognition (al desmontar).');
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null; recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null; recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      }
    };
  }, []); // Array de dependencias vacío

  // --- useEffect para Manejar la Tecla Enter (Modo Alternar) ---
  useEffect(() => {
    const handleKeyUp = (event) => {
      const targetTagName = event.target.tagName;
      if (targetTagName === 'INPUT' || targetTagName === 'TEXTAREA' || targetTagName === 'SELECT' || event.target.isContentEditable) return;

      if (event.key === 'Enter' && recognitionRef.current) {
        event.preventDefault();
        if (!isListening) {
          try {
            setVoiceError(''); setDisplayTranscript(''); finalAccumulatedTranscriptRef.current = '';
            console.log(">>> VR [Continuous]: KeyUp Enter - Llamando recognition.start()");
            recognitionRef.current.start();
          } catch (e) {
            console.error(">>> VR [Continuous]: Error al iniciar por Enter:", e);
            setVoiceError("No se pudo iniciar Mic."); setIsListening(false);
            if (onListeningChangeRef.current) onListeningChangeRef.current(false);
          }
        } else {
          try {
            console.log(">>> VR [Continuous]: KeyUp Enter - Llamando recognition.stop()");
            recognitionRef.current.stop();
          } catch (e) {
            console.error(">>> VR [Continuous]: Error al detener por Enter:", e);
            setVoiceError("Error al detener grabación."); setIsListening(false);
            if (onListeningChangeRef.current) onListeningChangeRef.current(false);
          }
        }
      }
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keyup', handleKeyUp); };
  }, [isListening]); // Depende de isListening

  // --- Renderizado ---
  if (!SpeechRecognition && !voiceError) { // Mostrar error solo si no hay soporte y no hay otro error
    return <div className="voice-recognition-error" title="Voz no soportada">🚫 Mic. No Soportado</div>;
  }
  return (
    <div className={`voice-recognition-ui ${isListening ? 'listening' : ''}`} style={{ padding: '15px', border: '2px solid #ccc', borderRadius: '8px', textAlign: 'center' }}>
      <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>
        {isListening ?
          <span style={{ color: 'red' }}>🔴 GRABANDO... (Presiona <kbd>Enter</kbd> para detener)</span> :
          <span style={{ color: 'green' }}>🔵 Presiona <kbd>Enter</kbd> para hablar.</span>
        }
      </p>
      {voiceError && <p style={{ color: 'red', fontStyle: 'italic' }}>Error: {voiceError}</p>}
      {isLoadingResponse && <p style={{ color: 'blue' }}>Procesando solicitud del padre...</p>}
      <div style={{ minHeight: '30px', background: '#f0f0f0', padding: '5px', marginTop: '5px', borderRadius: '4px' }}>
        <span style={{ fontWeight: '500' }}>Detectado: </span>
        <span>{displayTranscript || "..."}</span>
      </div>
       {(!isListening && (displayTranscript || voiceError)) && (
           <button
             onClick={() => {
                 setDisplayTranscript(''); setVoiceError(''); finalAccumulatedTranscriptRef.current = '';
                 if (onTextRecognizedRef.current) { onTextRecognizedRef.current('', true); }
             }}
             style={{ marginTop: '10px', padding: '5px 10px', fontSize: '0.8em' }}
           >
             Limpiar Texto
           </button>
       )}
    </div>
  );
};
export default VoiceRecognition;