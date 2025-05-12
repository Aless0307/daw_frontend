// src/pages/LoggedIn/Logica.jsx (o LogicSectionPage.jsx)
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Importa useCallback y useRef
// Importa tus componentes de UI
import Navbar from '../../components/Navbar'; // <-- Ajusta esta ruta si es necesario
import SideBar from './Componentes-Iniciado/SideBar'; // <-- Ajusta esta ruta si es necesario
// Importa tu componente VoiceRecognition
import VoiceRecognition from "./Componentes-Iniciado/Micro-enter"; // <-- Ajusta esta ruta si es necesario
// Importa tus funciones de API
// getAuthenticatedUserFromSession lee el user object de sessionStorage['user'] y lo parsea
import { getUserProgress, getLogicProblem, submitLogicAnswer, getAuthenticatedUserFromSession } from "../../utils/api"; // <-- Ajusta esta ruta si es necesario


// ---> IMPORTA TU HOOK DEL CONTEXTO DE AUTENTICACIÓN <---
// Usamos 'user' y 'loading' del contexto. El token se lee de sessionStorage en api.js.
// 'user' del contexto nos dirá si el AuthContext considera al usuario logeado.
import { useAuth } from '../../context/AuthContext'; // <-- ¡AJUSTA LA RUTA A TU CONTEXTO!
import { use } from 'react';

// TODO: Si usas react-router-dom para navegación de salida, impórtalo aquí
// import { useNavigate } from 'react-router-dom';


// Importa Web Speech API (aunque ya no la usemos directamente para hablar, puede ser útil para verificar disponibilidad o voces)
const SpeechSynthesis = window.speechSynthesis;
const SpeechSynthesisUtterance = window.SpeechSynthesisUtterance; // No se usa directamente en speakText ahora


// --- Definir los estados posibles de la interacción ---
const INTERACTION_STATES = {
    IDLE: 'idle', // Estado inicial, esperando que cargue el AuthContext
    LOADING_PROGRESS: 'loading_progress', // Cargando progreso del backend
    SHOWING_PROGRESS: 'showing_progress', // Progreso cargado y listo para ser leído/mostrado
    OFFERING_CHOICES: 'offering_choices', // Preguntando al usuario qué quiere hacer (practicar, progreso, salir)
    ASKING_DIFFICULTY: 'asking_difficulty', // Preguntando qué dificultad quiere practicar
    LOADING_PROBLEM: 'loading_problem', // Cargando un problema específico del backend
    PRESENTING_PROBLEM: 'presenting_problem', // Problema cargado y leído, esperando que el usuario grabe (tecla Enter)
    RECORDING_ANSWER: 'recording_answer', // El usuario está grabando (VoiceRecognition está activo)
    PROCESSING_ANSWER: 'processing_answer', // Enviando respuesta al backend, esperando LLM
    SHOWING_FEEDBACK: 'showing_feedback', // Feedback del LLM cargado y listo para ser leído/mostrado
    POST_FEEDBACK_CHOICES: 'post_feedback_choices', // Preguntando al usuario qué hacer después del feedback (otro, cambiar, salir)
    ERROR: 'error', // Algo salió mal, esperando instrucción de recuperación/salida
    EXITING: 'exiting' // Saliendo de la sección
};

let repeticion = 1;
// --- Flag para Session Storage para primera visita ---
const LOGIC_VISIT_FLAG_KEY = 'hasVisitedLogicSection'; // Clave para sessionStorage

// --- Helper para verificar si es la primera visita en esta sesión ---
const isFirstLogicVisit = () => {
    // Si la clave no existe en sessionStorage, es la primera visita
    return sessionStorage.getItem(LOGIC_VISIT_FLAG_KEY) === null;
};

// --- Helper para marcar que ya visitamos la sección en esta sesión ---
const setLogicVisitFlag = () => {
    // Guardar cualquier valor para indicar que ya visitamos
    sessionStorage.setItem(LOGIC_VISIT_FLAG_KEY, 'true');
};


// --- Helper para leer texto por voz (llamando al backend) ---
// Esta función se define FUERA del componente principal.
// Devuelve el objeto Audio si la reproducción se inicia correctamente.
// Dentro de LogicSectionPage.jsx (o donde definiste speakText)

const speakText = async (text, onEndCallback = null) => {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn("[speakText] Llamada con texto vacío.");
        if (onEndCallback) onEndCallback(); return null;
    }
    console.log(`[speakText] Solicitando voz para: "${text.substring(0, 50)}..."`);
    const API_TTS_URL = "http://127.0.0.1:8003/auth/api/logic/tts";
    const token = sessionStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token) {
        console.error("[speakText] No hay token para TTS.");
        if (onEndCallback) onEndCallback(); return null;
    }

    let audioUrl = null; // Definir fuera para que esté disponible en el catch final del fetch
    let audioContextForCleanup = null; // Para guardar la referencia del audio

    try {
        const response = await fetch(API_TTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: text }),
        });
        console.log(`[speakText] Fetch TTS: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            // ... (tu manejo de error de fetch como estaba) ...
            let errorDetail = `Backend TTS error: ${response.status}`;
            try { const errBody = await response.json(); errorDetail += ` - ${errBody.detail || JSON.stringify(errBody)}`; } catch (e) {}
            console.error("[speakText] ERROR TTS:", errorDetail);
            if (onEndCallback) onEndCallback();
            return null;
        }
        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob); // Asignar a la variable externa
        const audio = new Audio(audioUrl);
        audioContextForCleanup = audio; // Guardar referencia

        let hasEndedOrErrored = false; // Flag para evitar doble callback

        const cleanupAndCallback = () => {
            if (hasEndedOrErrored) return;
            hasEndedOrErrored = true;
            console.log("[speakText] cleanupAndCallback: Revocando URL del Blob:", audioUrl);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            if (onEndCallback && typeof onEndCallback === 'function') {
                onEndCallback();
            }
        };

        audio.onended = () => {
            console.log("[speakText] Audio playback finished via onended.");
            cleanupAndCallback();
        };

        audio.onerror = (e) => {
            console.error("[speakText] ERROR: Audio playback error via onerror.", e);
            if (e.target && e.target.error) {
                 console.error("[speakText] Detalle error Audio: Code=", e.target.error.code, "Message=", e.target.error.message);
            }
            cleanupAndCallback();
        };

        // Reproducir el audio
        console.log("[speakText] Intentando audio.play() para:", audioUrl);
        await audio.play(); // Usar await aquí para capturar el error de forma más directa
        console.log("[speakText] audio.play() promesa resuelta (reproducción probablemente iniciada).");
        // No llamar cleanupAndCallback aquí, se llamará en onended o onerror

        return audio; // Devolver el objeto Audio

    } catch (error) { // Este catch ahora manejará errores de fetch Y errores de audio.play()
        console.error("[speakText] ERROR GENERAL en speakText (fetch, blob, o play):", error);
        // Loguear detalles del error si es un error de reproducción
        if (error && error.name && error.message) {
             console.error(`[speakText] Detalles del playError: Name=${error.name}, Message=${error.message}`);
        }
        // Asegurar limpieza si audioUrl fue creado
        if (audioUrl && audioContextForCleanup) { // Usar audioContextForCleanup para evitar problemas de scope
            console.log("[speakText] Limpiando Blob URL en catch general:", audioUrl);
            URL.revokeObjectURL(audioUrl);
        }
        if (onEndCallback && typeof onEndCallback === 'function') { onEndCallback(); }
        return null;
    }
};

// Helper para manejar errores de flujo de interacción y pasar al estado ERROR (definida fuera)
// Ya no necesita speakText como argumento porque speakText es global
const handleInteractionErrorHelper = (errorMsg, setProblemError, setInteractionState, speakText, navigateToLogin = false, navigate = null) => { // speakText ya no se pasa, usar la función global
     console.error("[LogicPage] Interaction Error:", errorMsg);
     // Solo seteamos el error visual/para TTS si no es el error de no autenticado que puede ser manejado por redirección
     if (errorMsg !== "Debes iniciar sesión para acceder a esta sección.") {
          setProblemError(errorMsg); // Usamos problemError para errores de flujo general
     }
     setInteractionState(INTERACTION_STATES.ERROR); // Pasar a estado ERROR
     // Aquí llamamos a speakText directamente (ya no se pasa como argumento)
     speakText(`Error del sistema: ${errorMsg}. Por favor, intenta de nuevo o sal con Escape.`, () => {
          if(navigateToLogin && navigate){
              // Implementar navegación de salida aquí si es un error de autenticación
              console.log("[LogicPage] Redirecting to login after auth error.");
              navigate('/login'); // Ejemplo con react-router-dom
              // logout(); // Si la redirección también implica limpiar sesión actual
          }
     });
};


export const LogicSectionPage = () => {
  // --- Estado de la Sidebar (si lo usas, mantener esta parte) ---
   const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
   const handleSidebarToggle = useCallback((expanded) => { // Use useCallback for stability
     setIsSidebarExpanded(expanded);
   }, []); // Empty dependency array as it doesn't depend on anything else

  // --- Obtener estado de autenticación del contexto ---
   // Usamos 'user' y 'loading' del contexto. El token se lee de sessionStorage en api.js.
   // 'user' del contexto nos dirá si el AuthContext considera al usuario logeado.
   const { user, loading: authLoading, logout } = useAuth();
   // Opcional: Loguear si el token existe en sessionStorage (para depuración)
   console.log("[LogicPage] Auth State (from Context):", { user: user?.email, authLoading });
   console.log("[LogicPage] Token State (from SessionStorage):", sessionStorage.getItem('access_token') ? 'exists' : 'null');


  // TODO: Si usas react-router-dom para navegación de salida, inicializa el hook aquí
  // const navigate = useNavigate();


  // --- Estado principal de la interacción ---
  const [interactionState, setInteractionState] = useState(INTERACTION_STATES.IDLE);

  // --- Estados de datos ---
  const [userProgress, setUserProgress] = useState(null); // Progreso cargado
  const [currentProblem, setCurrentProblem] = useState(null); // Problema actual
  const [backendFeedback, setBackendFeedback] = useState(''); // Feedback del LLM
  const [recognizedText, setRecognizedText] = useState(''); // Texto de VoiceRecognition

  // --- Estados de errores ---
  const [progressError, setProgressError] = useState(null); // Error al cargar progreso (No usado actualmente, se usa problemError)
  const [problemError, setProblemError] = useState(null); // Error cargar problem, mensaje "no hay problem", o error de flujo gral
  const [backendError, setBackendError] = useState(''); // Errores de submit_answer o reconocimiento vacío

  // --- REFERENCIA PARA EL AUDIO ACTUALMENTE REPRODUCIÉNDOSE ---
  const audioRef = useRef(null); // Para mantener la referencia del objeto Audio

  // --- Helper para detener el audio actual y reproducir uno nuevo ---
  // Esta es la función que llamaremos DENTRO del componente para iniciar una reproducción.
  // Usa useCallback para que sea estable y no cause re-renders innecesarios.
  const speakAndStopOthers = useCallback(async (text, onEndCallback = null) => {
      // 1. Detener cualquier audio que se esté reproduciendo a través de esta referencia
      if (audioRef.current) {
          console.log("[speakAndStopOthers] Deteniendo audio previo.");
          audioRef.current.pause(); // Pausar
          audioRef.current.currentTime = 0; // Resetear tiempo (opcional)
           // No limpiamos la referencia ni el URL aquí, speakText lo hará al terminar/error si devuelve el objeto audio.
      }

       // Llamar a la función speakText global que hace el fetch y crea el Audio object
       // speakText AHORA DEBE DEVOLVER el objeto Audio si la llamada y creación fueron exitosas.
       const audioObject = await speakText(text, onEndCallback); // Pasar el callback original

       // Si speakText devolvió el objeto Audio, guardarlo en la referencia
       if (audioObject) {
            audioRef.current = audioObject;
       } else {
            // Si speakText devolvió null (error o texto vacío), asegurar que la referencia se limpia
            audioRef.current = null;
       }

   }, []); // Dependencias: ninguna si speakText es global y no usa estados/props


    // --- Helper para manejar errores de flujo de interacción (Usar useCallback) ---
    const handleInteractionError = useCallback((errorMsg, navigateToLogin = false) => {
        // Pasa null por navigate si no lo usas/necesitas aquí, o pasa el hook navigate si lo usas:
        // const navigate = useNavigate(); // <--- Descomentar si usas react-router-dom
        handleInteractionErrorHelper(errorMsg, setProblemError, setInteractionState, speakText, navigateToLogin, null); // O pasa 'navigate' si lo tienes
    }, [setProblemError, setInteractionState, speakText]); // Dependencias necesarias para el hook useCallback (añadir navigate si se usa)


  // --- Función para verificar si los datos mínimos de auth están en SessionStorage ---
  // Esta función reemplaza la verificación de 'token' en los triggers de los useEffect
  // Verificamos si las claves específicas de sessionStorage existen y tienen contenido.
  // Esto NO valida el contenido, solo si están presentes.
  const isAuthDataReadyForFlow = useCallback(() => {
       // Revisa si los campos clave existen en sessionStorage y no están vacíos.
       const tokenExists = typeof sessionStorage.getItem('access_token') === 'string' && sessionStorage.getItem('access_token').length > 0;
       const userJsonExists = typeof sessionStorage.getItem('user') === 'string' && sessionStorage.getItem('user').length > 0;

       // Verificamos también si el AuthContext logró setear un user object.
       // Esto ayuda a asegurar que el AuthContext al menos intentó inicializarse.
        const userObjectExistsInContext = !!user; // user viene de useAuth()


       return tokenExists && userJsonExists && userObjectExistsInContext && !authLoading; // AuthContext debe haber terminado de cargar

  }, [user, authLoading]); // Depende de si el user object en context cambia y si authLoading termina.


  // --- Función para cargar el progreso ---
  const loadProgress = useCallback(async () => {
         // SOLO ejecutar la llamada a la API si estamos en el estado correcto (LOADING_PROGRESS)
         if (interactionState !== INTERACTION_STATES.LOADING_PROGRESS) {
              console.log(`[LogicPage] loadProgress API call skipped. State is ${interactionState}.`);
              return; // No hacer la llamada API si no estamos en el estado LOADING_PROGRESS
         }
         // Si ya tenemos progreso y no estamos en un estado que requiera recarga (ej. después de resolver)
         // podemos saltar la llamada API, pero debemos asegurar la transición al siguiente estado.
         if (userProgress && (interactionState !== INTERACTION_STATES.ERROR && interactionState !== INTERACTION_STATES.POST_FEEDBACK_CHOICES)) {
              console.log("[LogicPage] Progress already loaded. Skipping API call.");
               // Si estábamos en LOADING_PROGRESS pero ya teníamos datos, pasar a mostrar.
               setInteractionState(INTERACTION_STATES.SHOWING_PROGRESS);
              return;
         }


         console.log("[LogicPage] Executing actual progress API call.");
         // El estado ya debe ser LOADING_PROGRESS al llegar aquí.

         // Verificamos ANTES de la llamada API que los datos de auth estén en SessionStorage.
         // La función getUserProgress (en api.js) también lo verifica internamente llamando a getAuthTokenFromSession.
         if (!isAuthDataReadyForFlow()) { // <-- Usamos la nueva verificación aquí
              console.error("[LogicPage] loadProgress API call attempted without sufficient auth data in SessionStorage!");
               // Esto no debería pasar si el flujo de estados es correcto, pero es una seguridad.
              handleInteractionError("No se encontraron datos de inicio de sesión válidos. Por favor, inicia sesión de nuevo.", true); // Redirigir/error
              return;
         }


         try {
           // LLAMADA API - SIN PASAR TOKEN (ya lo obtiene internamente de sessionStorage)
           const progressData = await getUserProgress();
           setUserProgress(progressData);
           console.log("[LogicPage] Progress API call successful.");
           setInteractionState(INTERACTION_STATES.SHOWING_PROGRESS); // Transición después de cargar

         } catch (error) {
           console.error("[LogicPage] Progress API call failed:", error);
            // Si es un error 401 de API, significa que el token de sessionStorage es inválido/expirado (el backend lo rechazó)
            // Asumiendo que el error tiene una propiedad status (puede variar según cómo manejes los errores de fetch/axios)
             if (error && error.status === 401) {
                  handleInteractionError("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.", true); // Redirigir/error
             } else {
                 handleInteractionError(`No se pudo cargar el progreso. ${error.message || 'Error desconocido'}`); // Transición a ERROR
             }

         }
    }, [userProgress, interactionState, handleInteractionError, getUserProgress, setUserProgress, setInteractionState, isAuthDataReadyForFlow]); // Dependencias. Asegurarse de que getUserProgress es estable.


  // --- useEffect para la Inicialización (Controla el flujo inicial IDLE -> OFFERING_CHOICES o ERROR) ---
  // Este efecto solo reacciona a cambios en el estado de autenticación y al estado IDLE
  useEffect(() => {
      console.log("[LogicPage] Auth state or interactionState changed.", { user: user?.email, authLoading, interactionState });

      // Si Auth context termina de cargar Y estamos en el estado inicial IDLE
      if (!authLoading && interactionState === INTERACTION_STATES.IDLE) {
          // Check if required auth data EXISTS IN SESSIONSTORAGE para iniciar el flujo
          if (isAuthDataReadyForFlow()) { // <-- Usamos la nueva verificación
            // Datos de autenticación necesarios encontrados en SessionStorage, START the flow
            console.log("[LogicPage] Auth finished, auth data found in SessionStorage. Offering initial choices.");
            setInteractionState(INTERACTION_STATES.OFFERING_CHOICES); // <-- CAMBIO CLAVE: Ir directo a ofrecer opciones
            
          } else {
            // Auth finished loading, but NO required data found in SessionStorage. User is NOT authenticated for this section.
            console.warn("[LogicPage] Auth finished loading, but NO auth data found in SessionStorage. User not authenticated for this section.");
            // Set a message and transition to ERROR state (marking it as an auth error)
            handleInteractionError("Debes iniciar sesión para acceder a esta sección.", true); // Pasar true para posible redirección
          }
        } else if (interactionState === INTERACTION_STATES.OFFERING_CHOICES) {
            // Auth finished loading, and we are in IDLE state. This means we are ready to offer choices.
            speakAndStopOthers("¿Quieres practicar lógica, escuchar tu progreso, o salir?")
            }
        else {
            // Auth finished loading, but we are NOT in IDLE state.
            // This means the flow was already started (or in ERROR etc.). Do nothing in this effect.
            console.log(`[LogicPage] Auth finished, but state is ${interactionState}. Initial load already handled.`);
        }
      }
      // If authLoading is true, the component is still initializing auth, do nothing in this effect yet.

  , [user, authLoading, interactionState, handleInteractionError, setInteractionState, isAuthDataReadyForFlow]); // Dependencias (Usamos user en lugar de token)


  // --- useEffect que se activa cuando el estado es LOADING_PROGRESS para llamar a la API ---
  // Este useEffect es DISPARADO AHORA SOLO por el comando "progreso" en handleTextRecognized.
  // Su lógica interna sigue llamando a loadProgress API call cuando el estado es LOADING_PROGRESS
  useEffect(() => {
       if (interactionState === INTERACTION_STATES.LOADING_PROGRESS) {
           console.log("[LogicPage] Entering LOADING_PROGRESS state. Initiating API call.");
           loadProgress();
       }

  }, [interactionState, loadProgress]); // Dependencia: se ejecuta cuando interactionState cambia a LOADING_PROGRESS (y loadProgress es estable)


  // --- useEffect para leer el progreso y pasar a OFERTAR OPCIONES ---
  // Se activa cuando el estado es SHOWING_PROGRESS
  useEffect(() => {
       if (interactionState === INTERACTION_STATES.SHOWING_PROGRESS && userProgress) {
           console.log("[LogicPage] Entering SHOWING_PROGRESS state. Reading progress.");
           // LINE 231 (CORRECTED): Ensure correct template literal syntax
           let progressText = `Tu progreso. Total resueltos: ${userProgress.total_solved}. Promedio general: ${userProgress.overall_average_grade !== null ? userProgress.overall_average_grade.toFixed(2) : 'N/A'}. `;
           Object.entries(userProgress.progress_by_difficulty).forEach(([level, data]) => {
                progressText += `Nivel ${level}: ${data.solved_count} resueltos${data.solved_count > 0 ? `, promedio ${data.average_grade.toFixed(2)}` : ''}. `;
           });
           // Leer el progreso y, al terminar, pasar al estado OFFERING_CHOICES
           speakAndStopOthers(progressText, () => {
                console.log("[LogicPage] Reading progress finished. Offering choices.");
                setInteractionState(INTERACTION_STATES.OFFERING_CHOICES); // Transición después de leer
           });

       }
  }, [interactionState, userProgress, setInteractionState, speakAndStopOthers]); // Depende de interactionState, userProgress, setInteractionState, y speakAndStopOthers


// --- Función para cargar un nuevo problema ---
const loadNewProblem = useCallback(async (difficulty = null) => {
    console.log(`[LogicPage] loadNewProblem - INICIO. Dificultad: ${difficulty}. Estado actual de interacción: ${interactionState}`);

    // Verificamos que los datos de auth estén en SessionStorage antes de intentar API call
    if (!isAuthDataReadyForFlow()) {
        console.error("[LogicPage] loadNewProblem - Falla la verificación isAuthDataReadyForFlow.");
        handleInteractionError("No hay datos de inicio de sesión disponibles en SessionStorage para cargar problema.", true); // Redirigir/error
        return;
    }

    // Evitar múltiples cargas o llamadas si ya estamos en proceso
    if (interactionState === INTERACTION_STATES.LOADING_PROBLEM || interactionState === INTERACTION_STATES.PROCESSING_ANSWER) {
        console.warn(`[LogicPage] loadNewProblem - Se intentó cargar pero ya estaba en estado: ${interactionState}. Se ignora.`);
        return;
    }

    console.log("[LogicPage] loadNewProblem - Estableciendo estado a LOADING_PROBLEM y reseteando estados relevantes.");
    setInteractionState(INTERACTION_STATES.LOADING_PROBLEM); // Nuevo estado: Cargando problema
    setProblemError(null); // Limpiar errores anteriores de problema/no hay problemas
    setCurrentProblem(null); // Limpiar problema anterior
    console.log("[LogicPage] loadNewProblem - currentProblem reseteado a null."); // LOG CLAVE
    setRecognizedText(''); // Limpiar input anterior de voz
    setBackendFeedback(''); // Limpiar feedback anterior
    setBackendError(''); // Limpiar errores de submit_answer/reconocimiento

    try {
        console.log("[LogicPage] loadNewProblem - Llamando a getLogicProblem con dificultad:", difficulty);
        const problemData = await getLogicProblem(difficulty);
        // Usar JSON.stringify para ver la estructura completa si es un objeto complejo.
        // Si problemData puede ser undefined o null, tener cuidado con stringify.
        console.log("[LogicPage] loadNewProblem - Datos recibidos de getLogicProblem:", typeof problemData === 'object' ? JSON.stringify(problemData) : problemData); // LOG CLAVE

        if (problemData && problemData._id) { // Asegúrate que aquí es _id
            setCurrentProblem(problemData);
            console.log("[LogicPage] loadNewProblem - setCurrentProblem EJECUTADO con datos. ID del Problema:", problemData._id); // LOG CLAVE
            setInteractionState(INTERACTION_STATES.PRESENTING_PROBLEM); // Indicar que el problema está listo para ser leído
            console.log("[LogicPage] loadNewProblem - Estado cambiado a PRESENTING_PROBLEM.");
        } else if (problemData && problemData.message) { // Si tiene un 'message', es el mensaje de no hay problemas
            setCurrentProblem(null); // Asegurar que no haya problema actual
            setProblemError(problemData.message); // Almacenar el mensaje
            console.warn("[LogicPage] loadNewProblem - No hay problemas disponibles. Mensaje:", problemData.message);
            speakAndStopOthers(`Mensaje del sistema. ${problemData.message}`, () => {
                console.log("[LogicPage] loadNewProblem - Mensaje 'No hay problemas' leído. Cambiando estado a OFFERING_CHOICES.");
                setInteractionState(INTERACTION_STATES.OFFERING_CHOICES);
            });
        } else {
            // Es posible que problemData sea null, undefined, o un formato inesperado
            console.error("[LogicPage] loadNewProblem - problemData no tiene _id ni message. problemData recibido:", typeof problemData === 'object' ? JSON.stringify(problemData) : problemData); // LOG CLAVE
            handleInteractionError("Error inesperado al obtener problema: Formato de respuesta desconocido o datos incompletos.");
        }
    } catch (error) {
        console.error("[LogicPage] loadNewProblem - ERROR en el bloque try-catch:", error);
        if (error && error.status === 401) {
            handleInteractionError("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.", true);
        } else {
            handleInteractionError(`No se pudo obtener un nuevo problema. ${error.message || 'Error desconocido'}`);
        }
    }
}, [interactionState, handleInteractionError, /*getLogicProblem,*/ /*setInteractionState,*/ /*setCurrentProblem,*/ /*setProblemError,*/ /*setRecognizedText,*/ /*setBackendFeedback,*/ /*setBackendError,*/ isAuthDataReadyForFlow, speakAndStopOthers]);
// NOTA SOBRE DEPENDENCIAS:
// Las dependencias comentadas son las funciones de estado (setX) o funciones importadas que usualmente son estables.
// ESlint puede quejarse si no están, pero si sabes que son estables, a veces se omiten para evitar re-creaciones innecesarias del callback.
// Sin embargo, es más seguro incluirlas todas como las tenías originalmente si no estás seguro:
// [interactionState, handleInteractionError, getLogicProblem, setInteractionState, setCurrentProblem, setProblemError, setRecognizedText, setBackendFeedback, setBackendError, isAuthDataReadyForFlow, speakAndStopOthers]

   // --- useEffect para leer el problema y pasar a PRESENTING_PROBLEM ---
   // Se activa cuando el estado es PRESENTING_PROBLEM
   useEffect(() => {
        if (interactionState === INTERACTION_STATES.PRESENTING_PROBLEM && currentProblem && currentProblem.text) {
            console.log("[LogicPage] Entering PRESENTING_PROBLEM state. Reading problem.");
            // Leer el problema y, al terminar, decir al usuario cómo grabar.
            // El estado se mantiene en PRESENTING_PROBLEM hasta que VoiceRecognition actúe (grabe/suelte Enter).
            speakAndStopOthers(`Problema. Dificultad ${currentProblem.difficulty}. ${currentProblem.text}. Presiona y mantén Enter para grabar tu respuesta.`, () => {
                  console.log("[LogicPage] Instruction to record read.");
                  // No hacemos transición de estado aquí. La transición RECORDING_ANSWER
                  // la manejará handleListeningStatusChange (if implementamos la prop).
            });

        }
   }, [interactionState, currentProblem, speakAndStopOthers]); // Dependencias



    // --- Función para manejar el envío de la respuesta ---
    // Es llamada desde handleTextRecognized cuando el estado es PRESENTING_PROBLEM y hay texto
    const handleAnswerSubmission = useCallback(async (answerText, problemId) => {
         // Verificamos que los datos de auth estén en SessionStorage antes de intentar API call
         if (!isAuthDataReadyForFlow() || !problemId || !answerText) { // <-- Usamos la nueva verificación
             handleInteractionError("Faltan datos (autenticación o respuesta/problema) para enviar la respuesta.");
             setInteractionState(INTERACTION_STATES.ERROR); // Asegurarse de ir a ERROR si faltan datos
             return;
         }
          // Solo procesar si estábamos en estado PRESENTING_PROBLEM esperando respuesta
          // OJO: Podríamos estar en RECORDING_ANSWER si handleTextRecognized se llama justo al terminar de grabar
          if (interactionState !== INTERACTION_STATES.PRESENTING_PROBLEM && interactionState !== INTERACTION_STATES.RECORDING_ANSWER) {
               console.warn("[LogicPage] handleAnswerSubmission called in incorrect state:", interactionState);
               return; // Solo procesar si estábamos esperando una respuesta al problema
          }

         setInteractionState(INTERACTION_STATES.PROCESSING_ANSWER); // Nuevo estado: Procesando respuesta
         setBackendError(''); // Limpiar errores anteriores de submit_answer


         try {
           // LLAMADA API - SIN PASAR TOKEN (ya lo obtiene internamente)
           const feedbackResponse = await submitLogicAnswer(problemId, answerText); // <-- YA NO PASAMOS TOKEN AQUÍ

           // La respuesta del backend debe tener el formato del LLM: { analysis: "...", grade: X }
           if (feedbackResponse && typeof feedbackResponse.analysis === 'string' && typeof feedbackResponse.grade === 'number') {
                // Almacenar feedback para mostrar/leer
                setBackendFeedback(`Análisis: ${feedbackResponse.analysis} \n Calificación: ${feedbackResponse.grade}/10.`); // Añadimos punto final para TTS
                console.log("[LogicPage] Feedback recibido:", feedbackResponse);
                 // Transición de estado después de recibir feedback
                setInteractionState(INTERACTION_STATES.SHOWING_FEEDBACK); // Indicar que el feedback está listo para ser leído

                // Opcional: Recargar el progreso en segundo plano (sin esperar await) para la siguiente visualización
                getUserProgress().then(setUserProgress).catch(e => console.error("Error reloading progress silently:", e));

           } else if (feedbackResponse && typeof feedbackResponse.detail === 'string') {
                // Si el backend devuelve un error de HTTP con detalle
                 handleInteractionError(`Error del backend: ${feedbackResponse.detail}`);
           }
           else {
                // Formato de respuesta de feedback inesperado
                handleInteractionError("Error: Formato de feedback del backend inesperado.");
           }

         } catch (error) {
           console.error("[LogicPage] Error al enviar respuesta al backend:", error);
            // Si es un error 401 de API
             if (error && error.status === 401) {
                  handleInteractionError("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.", true); // Redirigir/error
             } else {
                 handleInteractionError(`Error al procesar respuesta: ${error.message || 'Error desconocido'}`);
             }
         }
         // Nota: El estado se actualiza en el try/catch. Si todo falla, se va al estado ERROR.
         // El estado PROCESSING_ANSWER se mantiene hasta que una de las ramas try/catch/error lo cambie.
    }, [interactionState, handleInteractionError, submitLogicAnswer, setInteractionState, setBackendFeedback, setBackendError, getUserProgress, setUserProgress, isAuthDataReadyForFlow]); // Dependencias


    // --- useEffect para leer el feedback y pasar a POST_FEEDBACK_CHOICES ---
    // Se activa cuando el estado es SHOWING_FEEDBACK
    useEffect(() => {
       if (interactionState === INTERACTION_STATES.SHOWING_FEEDBACK && backendFeedback) {
           console.log("[LogicPage] Entering SHOWING_FEEDBACK state. Reading feedback.");
           // Leer feedback y, al terminar, pasar al estado POST_FEEDBACK_CHOICES
            speakAndStopOthers(`Feedback del asistente. ${backendFeedback}`, () => { // <-- USAR speakAndStopOthers
                 console.log("[LogicPage] Reading feedback finished. Offering post-feedback choices.");
                 setInteractionState(INTERACTION_STATES.POST_FEEDBACK_CHOICES); // Transición después de leer
                 // Al pasar a POST_FEEDBACK_CHOICES, la función handleTextRecognized
                 // interpretará los comandos "otro", "cambiar", "salir", "progreso".
                 // Opcional: Decir por voz las opciones principales después del feedback
                  speakAndStopOthers("¿Quieres otro problema, cambiar dificultad, escuchar tu progreso, o salir?"); // Es útil para guiar al usuario
            });
       } else if (interactionState === INTERACTION_STATES.SHOWING_FEEDBACK && backendError) {
            // Si hay un error de backend que llegó a SHOWING_FEEDBACK
            console.log("[LogicPage] Entering SHOWING_FEEDBACK state with backend error.", backendError);
             // No leer el error de "no voz detectada"
             if (backendError !== "No se detectó voz. Intenta hablar más claro.") {
                  speakAndStopOthers(`Error del sistema. ${backendError}. Por favor, intenta de nuevo o sal con Escape.`, () => { // <-- USAR speakAndStopOthers
                      // Después de leer el error, pasar a un estado donde se pueda salir o reintentar
                      console.log("[LogicPage] Reading backend error finished. Transitioning to ERROR.");
                      setInteractionState(INTERACTION_STATES.ERROR); // Pasar a estado ERROR
                  });
             } else {
                 // Si el error fue solo "no detectó voz", volver al estado de presentar problema para reintentar
                 console.log("[LogicPage] Reading 'no speech' error. Returning to PRESENTING_PROBLEM.");
                 // Limpiamos el error para que no se muestre visualmente persistentemente
                 setBackendError(''); // Limpiar el error
                 setInteractionState(INTERACTION_STATES.PRESENTING_PROBLEM); // Volver a esperar grabación
                  speakAndStopOthers("No detecté tu respuesta. Intenta de nuevo. Presiona y mantén Enter para grabar."); // <-- USAR speakAndStopOthers
             }
       }
    }, [interactionState, backendFeedback, backendError, setInteractionState, setBackendError, speakAndStopOthers]); // Dependencias


    // --- Función para manejar el texto reconocido (el INTERPRETE DE COMANDOS) ---
    // Es llamada por VoiceRecognition cuando la grabación termina y hay texto o está vacía
    const handleTextRecognized = useCallback(async (text, isClearRequest = false) => {
       // Guardar el texto reconocido solo si no es una solicitud de limpieza total
       if (!isClearRequest) {
            setRecognizedText(text); // Actualizar el estado local del texto reconocido
             // Opcional: Leer el texto reconocido al usuario para confirmación si lo deseas en algún estado
             // if (interactionState === INTERACTION_STATES.SOME_STATE_TO_CONFIRM_INPUT) { speakAndStopOthers(`Dijiste: ${text}`); } // <-- USAR speakAndStopOthers si se hace
       }

       // Limpiar el estado de backendError si fue por voz vacía de la vez anterior
       // Esto asegura que el mensaje visual y el estado de error se limpien
       if (backendError === "No se detectó voz. Intenta hablar más claro.") {
            setBackendError('');
       }


       // Lógica para limpiar la UI (si VoiceRecognition tiene un botón de limpiar que llama a esto)
       if (isClearRequest) {
           console.log("[LogicPage] Clear request received from VoiceRecognition.");
           setRecognizedText('');
           setBackendFeedback('');
           setBackendError('');
           setProblemError(null); // Limpiar errores de problema/flujo
           // Volver a un estado neutral o el de ofrecer opciones principal
           setInteractionState(INTERACTION_STATES.OFFERING_CHOICES); // Ejemplo: Volver a ofrecer opciones
            speakAndStopOthers("Conversación limpiada. ¿Quieres practicar lógica, escuchar tu progreso, o salir?"); // <-- USAR speakAndStopOthers
           return;
       }

       const lowerText = text.toLowerCase().trim();

       // Si no hay texto reconocido válido después de la grabación (y no fue una solicitud de limpieza)
       if (!lowerText) {
            console.warn("[LogicPage] Grabación finalizada sin texto reconocido después de trim.");
            // Si estábamos en un estado que esperaba una respuesta hablada (que no sea la respuesta al problema)
            if (interactionState === INTERACTION_STATES.ASKING_DIFFICULTY ||
                interactionState === INTERACTION_STATES.OFFERING_CHOICES ||
                interactionState === INTERACTION_STATES.POST_FEEDBACK_CHOICES ||
                interactionState === INTERACTION_STATES.ERROR) // También si esperábamos un comando de error/salida
             {
                 // Decir que no se entendió y repetir las opciones/pregunta
                 speakAndStopOthers("No detecté voz. Por favor, repite tu elección."); // <-- USAR speakAndStopOthers
                 // Mantener el estado actual para esperar otra respuesta hablada
             } else if (interactionState === INTERACTION_STATES.PRESENTING_PROBLEM || interactionState === INTERACTION_STATES.RECORDING_ANSWER) { // Aceptar también si VR termina antes de que el estado cambie a RECORDING_ANSWER
                 // Si estábamos esperando la respuesta al problema pero no se detectó voz
                  setBackendError("No se detectó voz. Intenta hablar más claro."); // Usamos backendError para este mensaje
                  // El useEffect de leer feedback/error lo leerá y nos devolverá a PRESENTING_PROBLEM
             } else {
                  // En otros estados (ej. LOADING, SHOWING_PROGRESS, PROCESSING_ANSWER, RECORDING_ANSWER), simplemente ignorar voz vacía.
                  console.log("Voz vacía ignorada en estado:", interactionState);
             }
            return; // Salir de la función si no hay texto para procesar
       }

        // --- Interpretación de Comandos Basada en el Estado ---
        console.log(`[LogicPage] Procesando texto "${lowerText}" en estado: ${interactionState}`);


       switch (interactionState) {
           case INTERACTION_STATES.OFFERING_CHOICES: // Esperando "practicar", "progreso", "salir"
               if (lowerText.includes('practicar') || lowerText.includes('ejercicio')) {
                   setInteractionState(INTERACTION_STATES.ASKING_DIFFICULTY);
                   speakAndStopOthers("Okay. ¿Qué dificultad quieres practicar: básico, intermedio o avanzado?"); // <-- USAR speakAndStopOthers
               } else if (lowerText.includes('progreso') || lowerText.includes('estadísticas')) {
                   // Volver a leer el progreso. Pasamos por SHOWING_PROGRESS.
                   setInteractionState(INTERACTION_STATES.LOADING_PROGRESS); // Transicionar a LOADING_PROGRESS para forzar recarga/relectura
               } else if (lowerText.includes('salir') || lowerText.includes('adiós')) {
                   setInteractionState(INTERACTION_STATES.EXITING);
                   speakAndStopOthers("Adiós. Espero verte pronto.", () => { /* ... */ }); // <-- USAR speakAndStopOthers
               } else {
                   // Comando no reconocido en este estado
                   speakAndStopOthers("No entendí. ¿Quieres practicar lógica, escuchar tu progreso, o salir?"); // <-- USAR speakAndStopOthers
                   // Mantener el estado OFFERING_CHOICES
               }
               break;

           case INTERACTION_STATES.ASKING_DIFFICULTY: // Esperando "básico", "intermedio", "avanzado"
                if (lowerText.includes('básico') || lowerText.includes('basico')) {
                   loadNewProblem('basico'); // loadNewProblem cambiará el estado a LOADING_PROBLEM
               } else if (lowerText.includes('intermedio')) {
                   loadNewProblem('intermedio'); // loadNewProblem cambiará el estado
               } else if (lowerText.includes('avanzado')) {
                   loadNewProblem('avanzado'); // loadNewProblem cambiará el estado
               } else {
                   // Dificultad no reconocida
                   speakAndStopOthers("Dificultad no válida. Por favor, di básico, intermedio o avanzado."); // <-- USAR speakAndStopOthers
                   // Mantener el estado ASKING_DIFFICULTY
               }
               break;

           case INTERACTION_STATES.PRESENTING_PROBLEM: // Esperando la respuesta al problema (la grabación ya terminó)
           case INTERACTION_STATES.RECORDING_ANSWER: // Aceptar también si VR termina antes de que el estado cambie a RECORDING_ANSWER
               // Si llegamos aquí con texto, es la respuesta al problema.
               if (lowerText) { // Asegurarse de que la transcripción no esté vacía después de trim
                   // Verificar si tenemos un currentProblem válido antes de intentar submit
                    if (currentProblem && currentProblem._id) {
                       handleAnswerSubmission(lowerText, currentProblem._id); // Llamar a la función de submit
                    } else {
                         console.warn("[LogicPage] Texto reconocido pero no hay currentProblem.id válido. Ignorando.");
                          // Podríamos informar al usuario por voz que no hay problema activo
                          // speakAndStopOthers("No hay un problema activo para responder."); // <-- USAR speakAndStopOthers si se hace
                    }
               } else {
                   console.warn("[LogicPage] Texto de respuesta al problema vacío después de trim.");
                   // Ya se maneja el error de "No detectó voz" arriba.
               }
               break;

           case INTERACTION_STATES.POST_FEEDBACK_CHOICES: // Feedback leído, esperando "otro", "cambiar", "salir", "progreso"
                if (lowerText.includes('otro') || lowerText.includes('siguiente')) {
                    // Cargar otro problema del MISMO NIVEL
                    const nextDifficulty = currentProblem?.difficulty; // Usar la dificultad del problema recién resuelto
                    if (nextDifficulty) {
                         speakAndStopOthers("Okay, buscando otro problema...", () => { // <-- USAR speakAndStopOthers
                              loadNewProblem(nextDifficulty); // Cargar siguiente del mismo nivel
                         });
                    } else {
                         // Si no sabemos la dificultad del problema anterior, pedirla de nuevo (caso raro)
                         speakAndStopOthers("Okay, otro problema...", () => { // <-- USAR speakAndStopOthers
                              setInteractionState(INTERACTION_STATES.ASKING_DIFFICULTY);
                              speakAndStopOthers("¿Qué dificultad quieres practicar?"); // <-- USAR speakAndStopOthers
                         });
                    }
                } else if (lowerText.includes('cambiar') || lowerText.includes('dificultad')) {
                    // Pedir cambiar dificultad
                    setInteractionState(INTERACTION_STATES.ASKING_DIFFICULTY);
                    speakAndStopOthers("Okay. ¿Qué dificultad quieres practicar: básico, intermedio o avanzado?"); // <-- USAR speakAndStopOthers
                } else if (lowerText.includes('salir') || lowerText.includes('adiós')) {
                    setInteractionState(INTERACTION_STATES.EXITING);
                   speakAndStopOthers("Adiós. Espero verte pronto.", () => { /* ... */ }); // <-- USAR speakAndStopOthers
                } else if (lowerText.includes('progreso') || lowerText.includes('estadísticas')) {
                     // Leer progreso y volver a ofrecer opciones post-feedback
                    speakAndStopOthers("Okay, revisemos tu progreso.", () => { // <-- USAR speakAndStopOthers
                         // Mostrar progreso (ya debería estar cargado). El useEffect se encargará de leerlo y volver a OFFERING_CHOICES
                         // Si queremos que después de leer progreso vuelva a POST_FEEDBACK_CHOICES, necesitaríamos lógica adicional.
                         // Por simplicidad, lo mandamos a LOADING_PROGRESS para releerlo y luego a OFFERING_CHOICES.
                         setInteractionState(INTERACTION_STATES.LOADING_PROGRESS); // Dispara la carga/relectura
                    });
                }
                else {
                    // Comando no reconocido en este estado
                    speakAndStopOthers("No entendí. ¿Quieres otro problema, cambiar dificultad, escuchar tu progreso, o salir?"); // <-- USAR speakAndStopOthers
                    // Mantener el estado POST_FEEDBACK_CHOICES
                }
               break;

           case INTERACTION_STATES.ERROR: // En estado de error, esperando comando de recuperación/salida
                if (lowerText.includes('salir') || lowerText.includes('adiós')) {
                     setInteractionState(INTERACTION_STATES.EXITING);
                       speakAndStopOthers("Okay, saliendo.", () => { /* ... */ }); // <-- USAR speakAndStopOthers
                } else if (lowerText.includes('intentar') || lowerText.includes('empezar') || lowerText.includes('inicio') || lowerText.includes('reiniciar')) {
                     // Intentar reiniciar el flujo
                      speakAndStopOthers("Okay, intentemos desde el inicio.", () => { // <-- USAR speakAndStopOthers
                           // Limpiar estados relevantes
                           setCurrentProblem(null);
                           setProblemError(null);
                           setBackendFeedback('');
                           setBackendError('');
                           setRecognizedText('');
                           setUserProgress(null); // Forzar recarga de progreso
                           // Volver al inicio del flujo principal (cargar progreso)
                           setInteractionState(INTERACTION_STATES.LOADING_PROGRESS); // Dispara la carga/relectura
                      });
                }
                else {
                     // Comando no reconocido en estado de error
                     speakAndStopOthers("No entendí. ¿Quieres salir, o intentar desde el inicio?"); // <-- USAR speakAndStopOthers
                     // Mantener estado ERROR
                }
               break;

           default: // Ignorar voz en otros estados (IDLE, LOADING, PROCESSING, RECORDING)
               console.log(`[LogicPage] Texto "${lowerText}" ignorado en estado: ${interactionState}`);
               break;
       }
    }, [interactionState, currentProblem, backendError, loadNewProblem, handleAnswerSubmission, setInteractionState, setRecognizedText, setBackendFeedback, setBackendError, setProblemError, setCurrentProblem, setUserProgress, handleInteractionError, speakAndStopOthers]); // Dependencias


    const handleListeningStatusChange = useCallback((isListening) => {
        console.log("[LogicPage] Micrófono callback:", isListening ? "EMPEZÓ A ESCUCHAR" : "TERMINÓ DE ESCUCHAR");
    
        if (isListening) {
            if (interactionState === INTERACTION_STATES.PRESENTING_PROBLEM) {
                console.log("[LogicPage] Micrófono INICIADO. Esperando respuesta al problema...");
                setBackendError('');
                // Cambiar a RECORDING_ANSWER sin reproducir audio para evitar conflictos
                setInteractionState(prevInteractionState =>
                    prevInteractionState === INTERACTION_STATES.PRESENTING_PROBLEM
                        ? INTERACTION_STATES.RECORDING_ANSWER
                        : prevInteractionState
                );
                // Eliminamos la reproducción de "Adelante" que parece estar causando conflictos
            }
        } else {
            // El micrófono ha terminado de escuchar (onend o onerror en VoiceRecognition)
            if (interactionState === INTERACTION_STATES.RECORDING_ANSWER) {
                console.log("[LogicPage] Micrófono DETENIDO. Procesando respuesta...");
                // VoiceRecognition llamará a onTextRecognized que manejará el siguiente estado.
            } else {
                // Si deja de escuchar y no estábamos grabando (ej. error al iniciar),
                // resetear el mensaje si se quedó en "Grabando..."
                console.log("[LogicPage] Micrófono DETENIDO pero no estábamos grabando. Limpiando mensaje.");
            }
        }
    }, [interactionState, setInteractionState, setBackendError]);

    // --- Implementar listener de teclado general (para acciones como Escape y Enter de flujo) ---
    useEffect(() => {
        const handleKeyDown = (event) => {
             // No procesar si un input/textarea tiene foco (si tuvieras alguno)
             if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                 return;
             }

            // Ignorar eventos de teclado si está en un estado de carga o procesamiento crítico donde no queremos interrupción.
            // O si está grabando (Enter lo maneja VR, Escape podría ser útil pero puede ser confuso)
            if (interactionState === INTERACTION_STATES.LOADING_PROGRESS ||
                interactionState === INTERACTION_STATES.LOADING_PROBLEM ||
                interactionState === INTERACTION_STATES.PROCESSING_ANSWER ||
                interactionState === INTERACTION_STATES.EXITING
               ) {
                 // console.log(`[LogicPage] Keyboard event (${event.key}) ignored during critical state: ${interactionState}`);
                return;
               }

            // --- Manejar tecla Escape ---
             if (event.key === 'Escape') {
                // Permitir salir desde cualquier estado excepto los críticos ya filtrados
                 console.log("[LogicPage] Escape pressed. Initiating exit.");
                 SpeechSynthesis.cancel(); // Limpiar cualquier TTS que esté hablando (menos crítico ahora con speakAndStopOthers, pero buena práctica)
                 // Asegurar que cualquier audio de backend también se detenga
                 if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current.currentTime = 0;
                       if (audioRef.current.url) URL.revokeObjectURL(audioRef.current.url);
                      audioRef.current = null;
                 }
                 // Asegurar que el micrófono se detenga si estaba activo
                  setInterruptTrigger(prev => prev + 1);


                 setInteractionState(INTERACTION_STATES.EXITING);
                  speakAndStopOthers("Saliendo de la sección de lógica. Adiós.", () => { // <-- USAR speakAndStopOthers
                      // TODO: Implementar navegación para salir de la sección
                      console.log("[LogicPage] Implementación de navegación de salida.");
                       // const navigate = useNavigate(); navigate('/'); // Ejemplo con react-router-dom, requiere el hook useNavigate
                       // logout(); // Si salir también implica hacer logout también
                  });
                 event.preventDefault(); // Prevenir comportamiento por defecto
                 return; // No procesar Enter si ya se presionó Escape
             }

            if (event.key === 'Enter') {
                // 1. Si ya se está grabando, VoiceRecognition lo maneja (para detener).
                //    Logica.jsx no hace nada.
                if (interactionState === INTERACTION_STATES.RECORDING_ANSWER) {
                    console.log("[LogicPage] Enter pressed during RECORDING_ANSWER. Handled by VoiceRecognition.");
                    // VoiceRecognition.jsx debe llamar a event.preventDefault() si lo necesita.
                    return;
                }

                // 2. Si estamos en un estado donde VoiceRecognition está visible y esperando
                //    Enter para INICIAR la grabación, Logica.jsx tampoco debe interferir.
                const isVoiceRecognitionActiveAndWaitingToStart = [
                    INTERACTION_STATES.OFFERING_CHOICES,
                    INTERACTION_STATES.ASKING_DIFFICULTY,
                    INTERACTION_STATES.PRESENTING_PROBLEM,
                    INTERACTION_STATES.POST_FEEDBACK_CHOICES,
                    INTERACTION_STATES.ERROR
                    // Asegúrate de que esta lista coincida con los estados donde VR está
                    // activo y Enter inicia la grabación.
                ].includes(interactionState);

                if (isVoiceRecognitionActiveAndWaitingToStart) {
                    console.log(`[LogicPage] Enter pressed in state ${interactionState}. VoiceRecognition should handle this to START recording. Logica.jsx takes no action.`);
                    // VoiceRecognition.jsx debe llamar a event.preventDefault() si lo necesita.
                    return;
                }

                // 3. Si llegamos aquí, Enter NO es para el micrófono en este momento.
                //    Y como NO quieres que Enter repita audios desde Logica.jsx,
                //    eliminamos toda la lógica que hacía eso.
                //    Lo que sigue es lo que puedes borrar de tu bloque original:
                //
                //    console.log("[LogicPage] Enter pressed outside recording. Repeating prompt or triggering action."); // <-- BORRAR o cambiar mensaje
                //    event.preventDefault(); // <-- BORRAR si Enter no debe hacer nada globalmente, o mantener si quieres prevenir default action siempre.
                //
                //    // TODAS LAS SIGUIENTES CONDICIONES if/else if QUE LLAMAN A speakAndStopOthers DEBEN SER BORRADAS:
                //    // if (interactionState === INTERACTION_STATES.ASKING_DIFFICULTY) { ... } <--- BORRAR
                //    // else if (interactionState === INTERACTION_STATES.POST_FEEDBACK_CHOICES) { ... } <--- BORRAR
                //    // else if (interactionState === INTERACTION_STATES.ERROR && problemError) { ... } <--- BORRAR
                //    // else if (interactionState === INTERACTION_STATES.SHOWING_PROGRESS && userProgress) { ... } <--- BORRAR
                //    // else if (interactionState === INTERACTION_STATES.PRESENTING_PROBLEM && currentProblem) { ... } <--- BORRAR (esta ya estaría cubierta por la guarda de arriba de todas formas)
                //    // else if (interactionState === INTERACTION_STATES.SHOWING_FEEDBACK && backendFeedback) { ... } <--- BORRAR

                // En su lugar, puedes dejar un log para saber que se presionó Enter
                // y no se tomó acción deliberadamente, o incluso no hacer nada.
                console.log(`[LogicPage] Enter pressed in state ${interactionState}. No TTS repeat action defined in Logica.jsx for Enter.`);
                // Opcional: Si quieres que Enter no haga absolutamente nada (como scroll, submit de form si existiera)
                // en estos otros casos, puedes dejar un event.preventDefault();
                // event.preventDefault();
            }

                 // Opcional: Implementar que Enter *después* de feedback pase al siguiente problema sin voz
                 // if (interactionState === INTERACTION_STATES.POST_FEEDBACK_CHOICES || interactionState === INTERACTION_STATES.SHOWING_FEEDBACK) {
                 //     console.log("[LogicPage] Enter pressed after feedback. Loading next problem.");
                 //      const nextDifficulty = currentProblem?.difficulty;
                 //      if (nextDifficulty) { loadNewProblem(nextDifficulty); } else { setInteractionState(INTERACTION_STATES.OFFERING_CHOICES); speakText("¿Qué dificultad quieres practicar?"); }
                 // }


                 event.preventDefault(); // Prevenir comportamiento por defecto del Enter (ej. en formularios)
            }
        

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            SpeechSynthesis.cancel(); // Limpiar TTS al desmontar
        };
    }, [interactionState, speakAndStopOthers, handleInteractionError, loadNewProblem, userProgress, currentProblem, backendFeedback, problemError]); // Dependencias


    // Define los anchos de la sidebar (si los usas para layout)
    const sidebarCollapsedWidth = 60; // px
    const sidebarExpandedWidth = 250; // px
    const mainContentPaddingLeft = isSidebarExpanded ? sidebarExpandedWidth : sidebarCollapsedWidth;


    // --- Lógica de renderizado condicional ---
    // Mostramos diferentes mensajes o componentes según el estado de interacción
  return (
    // Contenedor principal
    
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* SideBar (si lo usas) */}
      {/* ASEGÚRATE DE QUE ESTA LÍNEA NO ESTÉ COMENTADA Y LA RUTA SEA CORRECTA */}
      <SideBar isExpanded={isSidebarExpanded} onToggleExpansion={handleSidebarToggle} />

      {/* Contenedor del Contenido Principal */}
      <main
        className="flex-1 min-w-0 overflow-x-hidden"
        style={{ paddingLeft: `${mainContentPaddingLeft}px`, transition: 'padding-left 0.3s ease' }}
      >
        {/* Navbar (si lo usas) */}
         {/* ASEGÚRATE DE QUE ESTA LÍNEA NO ESTÉ COMENTADA Y LA RUTA SEA CORRECTA */}
        <Navbar />

        {/* Contenido específico de la Sección de Lógica */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"> {/* CORREGIDO: lg-px-8 -> lg:px-8 */}
            <h1>Sección de Lógica de Programación</h1>
            <p>Aquí puedes practicar problemas de lógica. Tu progreso y las respuestas serán analizadas.</p>

            {/* Mensajes de estado general o carga */}
            <div style={{ marginTop: '20px', fontWeight: 'bold', minHeight: '2em' }}>
                {/* Si el AuthContext está cargando */}
                {authLoading && interactionState === INTERACTION_STATES.IDLE && <p>Cargando datos de usuario...</p>}

                {/* Mensajes basados en el estado de interacción */}
                {!authLoading && (
                    <>
                       {/* Mostrar IDLE si no hay user object O si no hay datos de auth en sessionStorage */}
                       {interactionState === INTERACTION_STATES.IDLE && !isAuthDataReadyForFlow() && <p>Iniciando sección de lógica...</p>}

                       {interactionState === INTERACTION_STATES.LOADING_PROGRESS && <p>Cargando progreso...</p>}
                       {interactionState === INTERACTION_STATES.SHOWING_PROGRESS && <p>Mostrando tu progreso...</p>}
                       {interactionState === INTERACTION_STATES.OFFERING_CHOICES && <p>Di: "practicar", "progreso" o "salir".</p>}
                       {interactionState === INTERACTION_STATES.ASKING_DIFFICULTY && <p>Di la dificultad: "básico", "intermedio" o "avanzado".</p>}
                       {interactionState === INTERACTION_STATES.LOADING_PROBLEM && <p>Cargando problema...</p>}
                       {interactionState === INTERACTION_STATES.PRESENTING_PROBLEM && <p>Problema cargado. Esperando grabación...</p>}
                       {interactionState === INTERACTION_STATES.RECORDING_ANSWER && <p style={{color: 'green'}}>🎙️ Grabando respuesta... (Suelta 'Enter' para terminar)</p>}
                       {interactionState === INTERACTION_STATES.PROCESSING_ANSWER && <p>Procesando respuesta...</p>}
                       {interactionState === INTERACTION_STATES.SHOWING_FEEDBACK && <p>Mostrando feedback...</p>}
                       {interactionState === INTERACTION_STATES.POST_FEEDBACK_CHOICES && <p>Di: "otro problema", "cambiar dificultad, escuchar tu progreso, o salir".</p>}
                       {interactionState === INTERACTION_STATES.EXITING && <p>Saliendo...</p>}
                    </>
                )}
                 {/* Mostrar error general de flujo si el estado es ERROR */}
                 {interactionState === INTERACTION_STATES.ERROR && problemError && (
                     <p style={{ color: 'red', fontWeight: 'bold' }}>{problemError}. Di "intentar de nuevo" o "salir".</p>
                 )}
            </div>


            {/* Mostrar Progreso del Usuario - Solo si ha sido cargado y el estado lo permite */}
            {userProgress && (interactionState === INTERACTION_STATES.SHOWING_PROGRESS || interactionState === INTERACTION_STATES.OFFERING_CHOICES || interactionState === INTERACTION_STATES.POST_FEEDBACK_CHOICES || interactionState === INTERACTION_STATES.ERROR) && (
                 <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '15px', background: '#f9f9f9' }}>
                     <h2>Tu Progreso</h2>
                     {userProgress && ( // Asegurarse de que userProgress no sea null
                         <div>
                             <p>Total resueltos: {userProgress.total_solved}</p>
                             <p>Promedio general: {userProgress.overall_average_grade !== null ? userProgress.overall_average_grade.toFixed(2) : 'N/A'}</p>
                             <ul>
                                 {Object.entries(userProgress.progress_by_difficulty).map(([level, data]) => (
                                     <li key={level}>
                                         {level.charAt(0).toUpperCase() + level.slice(1)}: {data.solved_count} resueltos {data.solved_count > 0 ? `(Promedio: ${data.average_grade.toFixed(2)})` : ''}
                                     </li>
                                 ))}
                             </ul>
                         </div>
                     )}
                 </div>
             )}

             {/* Mostrar Problema Actual - Solo si ha sido cargado y el estado lo permite */}
            {currentProblem && (interactionState === INTERACTION_STATES.PRESENTING_PROBLEM || interactionState === INTERACTION_STATES.RECORDING_ANSWER || interactionState === INTERACTION_STATES.PROCESSING_ANSWER || interactionState === INTERACTION_STATES.SHOWING_FEEDBACK || interactionState === INTERACTION_STATES.POST_FEEDBACK_CHOICES || interactionState === INTERACTION_STATES.ERROR) && (
                <div style={{ marginTop: '20px', border: '2px solid blue', padding: '15px', background: '#eaf6ff' }}>
                    <h3>Problema de Lógica (Dificultad: {currentProblem.difficulty})</h3>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{currentProblem.text}</p>
                </div>
            )}

            {/* Integrar tu componente VoiceRecognition */}
            {/* Mostrarlo solo en los estados donde esperamos INPUT de voz del usuario */}
             {(interactionState === INTERACTION_STATES.OFFERING_CHOICES ||
               interactionState === INTERACTION_STATES.ASKING_DIFFICULTY ||
               interactionState === INTERACTION_STATES.PRESENTING_PROBLEM ||
               interactionState === INTERACTION_STATES.RECORDING_ANSWER ||
               interactionState === INTERACTION_STATES.POST_FEEDBACK_CHOICES ||
               interactionState === INTERACTION_STATES.ERROR
             ) && !authLoading && ( // Añadir !authLoading para evitar mostrarlo mientras carga auth
            // Dentro del return de LogicSectionPage.jsx

            <div style={{marginTop: '25px'}}>
                <p style={{textAlign: 'center', fontWeight:'bold', marginBottom:'10px'}}>Control de Voz:</p>
                <VoiceRecognition
                    onTextRecognized={handleTextRecognized}
                    isLoadingResponse={interactionState === INTERACTION_STATES.PROCESSING_ANSWER}
                    onListeningChange={handleListeningStatusChange}
                    // Eliminamos la key dinámica que causa el remontaje
                />
                 {recognizedText && <p style={{marginTop: '10px', fontSize: '0.9em', color: '#555'}}>Texto reconocido: "{recognizedText}"</p>}
                 {backendError && <p style={{ color: 'orange', fontWeight: 'bold', marginTop: '10px' }}>{backendError}</p>}
             </div>
             )}

             {/* Mostrar el feedback del backend (análisis/calificación) si está disponible */}
             {backendFeedback && (interactionState === INTERACTION_STATES.SHOWING_FEEDBACK || interactionState === INTERACTION_STATES.POST_FEEDBACK_CHOICES || interactionState === INTERACTION_STATES.ERROR) && (
                 <div style={{ marginTop: '20px', border: '2px solid green', padding: '15px', background: '#eafaf9' }}>
                     <h3>Feedback del Asistente:</h3>
                     <p style={{ whiteSpace: 'pre-wrap' }}>{backendFeedback}</p>
                 </div>
             )}
             {/* Mostrar error específico si es el de "no detectó voz" */}
              {(interactionState === INTERACTION_STATES.PRESENTING_PROBLEM || interactionState === INTERACTION_STATES.RECORDING_ANSWER || interactionState === INTERACTION_STATES.PROCESSING_ANSWER) && backendError === "No se detectó voz. Intenta hablar más claro." && (
                   <p style={{ color: 'orange', fontWeight: 'bold', marginTop: '10px' }}>{backendError}</p>
              )}
             {/* Mostrar error general de submit/backend si existe y no es el de voz vacía */}
             {(interactionState === INTERACTION_STATES.PROCESSING_ANSWER || interactionState === INTERACTION_STATES.SHOWING_FEEDBACK || interactionState === INTERACTION_STATES.POST_FEEDBACK_CHOICES || interactionState === INTERACTION_STATES.ERROR) && backendError && backendError !== "No se detectó voz. Intenta hablar más claro." && (
                 <p style={{ color: 'red', fontWeight: 'bold', marginTop: '10px' }}>{backendError}</p>
            )}


        </div>
      </main>
    </div>
  );
};

export default LogicSectionPage;