import React, { useState, useEffect, useRef } from 'react';

// --- Verifica si la Web Speech API está disponible ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const VoiceRecognition = ({ onTextRecognized, responseData, isLoadingResponse, responseError }) => {
  // --- Estados ---
  const [recognizedText, setRecognizedText] = useState(''); // Texto capturado por voz
  const [isListening, setIsListening] = useState(false); // Estado del micrófono
  const [voiceError, setVoiceError] = useState(''); // Errores del reconocimiento de voz

  // --- Referencias (persisten entre renders sin causar re-render) ---
  const recognitionRef = useRef(null); // Instancia del objeto SpeechRecognition
  const isHoldingEnter = useRef(false); // Flag para saber si Enter está presionado

  // --- useEffect para la Configuración del Reconocimiento de Voz y Eventos ---
  useEffect(() => {
    // Si la Web Speech API no está disponible, mostrar error y salir del efecto
    if (!SpeechRecognition) {
      setVoiceError("La Web Speech API no es soportada por este navegador.");
      return;
    }

    // --- Inicializar la instancia de SpeechRecognition ---
    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Queremos una sola "escucha" por cada vez que se presiona Enter
    recognition.interimResults = false; // Solo capturar el resultado final
    recognition.lang = 'es-ES'; // Configura el idioma. ¡Cámbialo si es necesario!

    // --- Handlers de Eventos de SpeechRecognition ---
    recognition.onstart = () => {
       setIsListening(true); // Actualizar estado a "escuchando"
       setVoiceError(''); // Limpiar errores de voz anteriores al iniciar
       console.log('Reconocimiento de voz iniciado.');
    };

    recognition.onresult = (event) => {
      // Este evento se dispara cuando se reconoce una porción de voz final
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log('Resultado de voz final:', transcript);
      setRecognizedText(transcript); // Almacenar el texto reconocido

      // Enviar el texto al componente padre para procesarlo
      if (onTextRecognized) {
        onTextRecognized(transcript);
      }
    };

    recognition.onerror = (event) => {
      // Manejar errores de reconocimiento de voz
      console.error('Error en reconocimiento de voz:', event.error);
      setIsListening(false); // Detener estado de escucha
      isHoldingEnter.current = false; // Asegurar que el flag de Enter se resetee

      let errorMsg = `Error de voz: ${event.error}`;
       if (event.error === 'not-allowed') {
            errorMsg = 'Permiso del micrófono denegado. Por favor, permite el acceso.';
       } else if (event.error === 'no-speech') {
            errorMsg = 'No se detectó voz. Intenta hablar más claro o ajusta el micrófono.';
       } else if (event.error === 'network') {
            errorMsg = 'Error de red durante el reconocimiento de voz.';
       } else if (event.error === 'aborted') {
           errorMsg = 'Reconocimiento abortado.'; // Común si abortamos manualmente al presionar Enter de nuevo
       }

       setVoiceError(errorMsg);
       setRecognizedText(''); // Limpiar texto reconocido en caso de error
    };

    recognition.onend = () => {
      // Este evento se dispara cuando la escucha termina
      console.log('Reconocimiento de voz finalizado.');
      setIsListening(false); // Asegurar que el estado de escucha es falso
      isHoldingEnter.current = false; // Asegurar que el flag de Enter se resetee
    };

    // Guardar la instancia en la referencia para usarla en los handlers de teclado
    recognitionRef.current = recognition;

    // --- Handlers de Eventos del Teclado (en la ventana global) ---
    const handleKeyDown = (event) => {
      // Iniciar reconocimiento solo si es la tecla Enter y no la estamos manteniendo ya
      if (event.key === 'Enter' && !isHoldingEnter.current) {
        isHoldingEnter.current = true; // Marcar Enter como presionado
        // Limpiar estados anteriores al iniciar una nueva interacción
        setRecognizedText('');
        setVoiceError('');

        try {
           // Abortar cualquier sesión de reconocimiento previa que pudiera estar activa o pendiente
           if(recognitionRef.current && (recognitionRef.current.recognizing || isListening)) {
               recognitionRef.current.abort(); // Abortar detiene inmediatamente y dispara 'onend'
           }
           // Iniciar el reconocimiento de voz
           recognitionRef.current.start();
        } catch (e) {
           console.error("Error al intentar iniciar el reconocimiento de voz:", e);
           setIsListening(false);
           isHoldingEnter.current = false;
           setVoiceError("Error al iniciar el micrófono. ¿Permiso denegado o no soportado?");
        }
      }
    };

    const handleKeyUp = (event) => {
      // Detener reconocimiento solo si es la tecla Enter y la estábamos manteniendo
      if (event.key === 'Enter' && isHoldingEnter.current) {
        isHoldingEnter.current = false; // Marcar Enter como soltado
        // Llamar a stop() para detener el reconocimiento. Esto dispara el evento 'onend'.
        // Solo llamar stop si estaba escuchando para evitar errores.
        if (recognitionRef.current && isListening) {
             recognitionRef.current.stop();
        } else {
             // Si soltó Enter pero no estaba escuchando (quizás por un error),
             // solo asegurar que el estado y el flag estén correctos.
             setIsListening(false);
        }
      }
    };

    // Añadir los listeners de eventos al objeto global 'window'
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // --- Función de Limpieza ---
    // Se ejecuta cuando el componente se desmonta
    return () => {
      console.log('Limpiando componente VoiceRecognition.');
      // Remover los listeners de eventos del teclado para evitar fugas de memoria
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      // Abortar el reconocimiento de voz si todavía está activo
      if (recognitionRef.current && (recognitionRef.current.recognizing || isListening)) {
        recognitionRef.current.abort(); // abort() es más seguro para limpieza rápida
      }
    };
  }, [onTextRecognized]); // Dependencia añadida para ejecutar el efecto cuando cambie la función

  // --- Renderizado del Componente ---
  return (
    <div style={{ margin: '20px', padding: '25px', border: '3px solid #4a148c', borderRadius: '15px', fontFamily: 'sans-serif', backgroundColor: '#f3e5f5', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ color: '#4a148c', marginBottom: '20px', textAlign: 'center' }}>🎤 Reconocimiento de Voz 🤖</h2>

      {/* Indicador de estado del micrófono */}
      <p style={{ marginBottom: '15px', fontSize: '1.1em', color: '#333' }}>
        Estado del Micrófono: {isListening ?
                 <span style={{ color: '#388e3c', fontWeight: 'bold' }}>🎙️ Escuchando...</span> :
                 <span style={{ color: '#757575' }}>🔘 Presiona y mantén la tecla <kbd>Enter</kbd> para hablar.</span>
               }
      </p>

      {/* Mostrar errores de voz */}
      {voiceError && (
          <p style={{ color: '#d32f2f', fontWeight: 'bold', marginBottom: '15px', padding: '10px', backgroundColor: '#ffebee', borderRadius: '5px' }}>Error de Voz: {voiceError}</p>
      )}

      {/* Área para mostrar el texto reconocido por voz */}
      <div style={{ marginTop: '15px', padding: '15px', border: '1px dashed #ab47bc', minHeight: '80px', backgroundColor: '#fce4ec', borderRadius: '8px', wordBreak: 'break-word' }}>
        <strong style={{ color: '#6a1b9a' }}>Tu Voz (Prompt para el Asistente):</strong>
        <p style={{ color: '#4a148c', fontStyle: recognizedText ? 'normal' : 'italic' }}>
            {recognizedText || 'El texto que digas aparecerá aquí después de hablar...'}
        </p>
      </div>

      {/* Indicador de carga de la respuesta */}
       {isLoadingResponse && (
           <p style={{ marginTop: '15px', color: '#4a148c', fontWeight: 'bold', textAlign: 'center' }}>
               Enviando consulta, esperando respuesta... ⏳
           </p>
       )}

      {/* Área para mostrar la respuesta */}
      <div style={{ marginTop: '20px', padding: '15px', border: '2px solid #4a148c', minHeight: '120px', backgroundColor: '#ede7f6', borderRadius: '8px', wordBreak: 'break-word' }}>
        <strong style={{ color: '#4a148c' }}>Respuesta del Asistente:</strong>
        <p style={{ color: '#311b92', fontStyle: responseData || responseError ? 'normal' : 'italic' }}>
            {responseData || responseError || 'La respuesta aparecerá aquí...'}
        </p>
      </div>

       {/* Mostrar errores de respuesta */}
       {responseError && (
           <p style={{ color: '#d32f2f', fontWeight: 'bold', marginTop: '15px', padding: '10px', backgroundColor: '#ffebee', borderRadius: '5px' }}>Error: {responseError}</p>
       )}

      {/* Botón para limpiar el chat */}
       {(recognizedText || responseData || voiceError || responseError) && (
           <button
             onClick={() => {
                 setRecognizedText('');
                 setVoiceError('');
                 if (onTextRecognized) {
                     onTextRecognized('', true); // Segundo parámetro indica limpieza
                 }
             }}
             style={{ marginTop: '25px', padding: '10px 20px', cursor: 'pointer', border: 'none', borderRadius: '5px', backgroundColor: '#ab47bc', color: 'white', fontSize: '1em', fontWeight: 'bold', display: 'block', margin: '0 auto' }}
           >
             Limpiar Chat
           </button>
       )}
    </div>
  );
};

export default VoiceRecognition;