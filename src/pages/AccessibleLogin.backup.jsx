import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Importar componentes modulares
import VoiceRecorder from '../components/VoiceRecorder';
import VoiceLogin from '../components/VoiceLogin';
import FaceRecorder from '../components/FaceRecorder';
import FaceLogin from '../components/FaceLogin';
import BraillePassword from '../components/BraillePassword';

// Importar servicios modularizados
import { 
    queueAudioMessage, 
    AUDIO_MESSAGES, 
    stopCurrentAudio, 
    repeatLastMessage, 
    playWithFallback 
} from '../components/AccessibleLogin/AudioService';
import { SpeechRecognitionService } from '../components/AccessibleLogin/SpeechRecognitionService';
import { SpeechProcessor } from '../components/AccessibleLogin/SpeechProcessor';
import { StateManager } from '../components/AccessibleLogin/StateManager';
import { RegistrationHandler } from '../components/AccessibleLogin/RegistrationHandler';
import { LoginHandler } from '../components/AccessibleLogin/LoginHandler';

// Claves de los mensajes de audio predefinidos
const LAST_MESSAGE_KEY = 'accessibleLogin_lastAudioMessage';

const AccessibleLogin = () => {
    console.log('Renderizando AccessibleLogin');
    
    // Estados para control de UI
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);
    const [audioError, setAudioError] = useState(false);
    const [silenceTimer, setSilenceTimer] = useState(null);
    
    // Estados para control de flujo
    const [isRegistering, setIsRegistering] = useState(false);
    const [showVoiceLogin, setShowVoiceLogin] = useState(false);
    const [showFaceLogin, setShowFaceLogin] = useState(false);
    const [showBrailleInput, setShowBrailleInput] = useState(false);
    const [isBrailleComplete, setIsBrailleComplete] = useState(false);
    
    // Estados para datos de formulario
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    
    // Estados para grabación de voz y captura de imagen
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [photoBlob, setPhotoBlob] = useState(null);

    // NUEVO: Estado para controlar el paso actual del registro
    const [registrationStep, setRegistrationStep] = useState(null); // null, 'braille', 'voice', 'face', 'complete'
    const [voiceRegistrationComplete, setVoiceRegistrationComplete] = useState(false);
    const [playingAudio, setPlayingAudio] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Referencias
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const hasPlayedWelcomeRef = useRef(false);
    const finalTranscriptRef = useRef('');
    const lastMessageRef = useRef('');
    const audioContextRef = useRef(null);
    const voiceRegisteredRef = useRef(false); // Para evitar activación duplicada
    
    const navigate = useNavigate();
    const { login } = useAuth();

    // Inicializar servicios modularizados
    const stateManager = new StateManager(
        setIsRegistering,
        setShowVoiceLogin,
        setShowFaceLogin,
        setIsLoggingIn
    );

    const speechProcessor = new SpeechProcessor(
        (action) => stateManager.updateAppState(action, isRegistering, showVoiceLogin, showFaceLogin, isLoggingIn),
        setUsername,
        setEmail,
        setShowBrailleInput,
        () => setIsListening(false),
        isListening
    );

    // Inicializar manejadores
    const { handleVoiceLoginSuccess, handleSubmitLogin } = LoginHandler({
        username,
        password,
        setError,
        login,
        navigate
    });

    const { 
        handleVoiceRecordingComplete: handleVoiceRecording, 
        handleBraillePasswordComplete: handleBraillePassword,
        handleSubmitRegistration
    } = RegistrationHandler({
        username,
        email,
        password,
        audioBlob,
        photoBlob,
        setSuccess,
        setError,
        setIsRegistering,
        setEmail,
        setPassword,
        setUsername,
        setAudioBlob,
        setPhotoBlob
    });

    // Función para manejar la interacción del usuario
    const handleUserInteraction = () => {
        if (!isInitialized && !hasPlayedWelcomeRef.current) {
            setIsInitialized(true);
            hasPlayedWelcomeRef.current = true;
            // Reproducir mensaje de bienvenida y luego preguntar si quiere iniciar sesión o registrarse
            queueAudioMessage(AUDIO_MESSAGES.welcome);
            setTimeout(() => {
                queueAudioMessage(AUDIO_MESSAGES.askLoginOrRegister);
            }, 2000); // Esperar 2 segundos después del mensaje de bienvenida
        }
    };

    // Añadir event listeners para cualquier interacción
    useEffect(() => {
        const events = ['click', 'touchstart'];
        events.forEach(event => {
            window.addEventListener(event, handleUserInteraction, { once: true });
        });

        // Añadir listener para las teclas espacio y enter
        const handleKeyPress = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (isPlayingRef.current) {
                    // Si está reproduciendo audio, detenerlo
                    stopCurrentAudio();
                } else if (!isListening && !showBrailleInput) {
                    // Solo iniciar reconocimiento si no está el braille activo
                    handleStartListening();
                }
            } else if (e.code === 'Enter') {
                e.preventDefault();
                // Repetir el último mensaje
                repeatLastMessage();
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleUserInteraction);
            });
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [isListening, showBrailleInput]);

    // Inicializar servicio de reconocimiento de voz
    const speechRecognition = new SpeechRecognitionService(
        setTranscript,
        (text) => speechProcessor.processUserSpeech(text, isRegistering, showVoiceLogin, showFaceLogin),
        setIsListening,
        setError
    );

    const handleStartListening = async () => {
        console.log('🎙️ Iniciando reconocimiento de voz...');
        
        // No iniciar reconocimiento si se está mostrando la interfaz de braille
        if (showBrailleInput) {
            console.log('⚠️ No se puede iniciar el reconocimiento mientras está activa la interfaz de braille');
            return;
        }
        
        // Verificar si hay audio reproduciéndose antes de iniciar el reconocimiento
        if (isPlayingRef.current) {
            console.log('⚠️ No se puede iniciar el reconocimiento de voz mientras se reproduce un audio');
            return;
        }
        
        // Si estamos en modo registro, mostrar un mensaje visual de ayuda
        if (isRegistering) {
            // Mostrar un mensaje visual de ayuda
            setTranscript('Esperando que digas tu información...');
        }
        
        // Iniciar reconocimiento de voz
        await speechRecognition.startListening();
    };

    const handleStopListening = () => {
        speechRecognition.stopListening();
    };

    // Funciones para grabación de voz
    const handleVoiceRecordingComplete = (blob) => {
        handleVoiceRecording(blob, voiceRegisteredRef, setVoiceRegistrationComplete, setRegistrationStep);
    };

    const handleStartRecording = () => {
        setIsRecording(true);
    };

    const handleStopRecording = () => {
        setIsRecording(false);
    };

    // Funciones para captura facial
    const handlePhotoComplete = (blob) => {
        setPhotoBlob(blob);
    };

    const handleStartCapture = () => {
        setIsCapturing(true);
    };

    const handleStopCapture = () => {
        setIsCapturing(false);
    };

    // Función para manejar la contraseña en braille
    const handleBraillePasswordComplete = (braillePassword) => {
        handleBraillePassword(braillePassword, setShowBrailleInput, setIsBrailleComplete);
    };

    // Verificar el estado de showBrailleInput
    useEffect(() => {
        if (showBrailleInput) {
            console.log('🔐 showBrailleInput ha cambiado a true - Iniciando creación de contraseña braille');
            // Detener reconocimiento de voz si está activo
            if (isListening) {
                handleStopListening();
            }
        }
    }, [showBrailleInput, isListening]);

    // Verificar si el usuario ya se registró previamente
    const [wasRegistered, setWasRegistered] = useState(false);

    useEffect(() => {
        const registeredFlag = sessionStorage.getItem('registered');
        if (registeredFlag === 'true') {
            setWasRegistered(true);
            sessionStorage.removeItem('registered'); // Limpiar para que no se muestre otra vez
        }
    }, []);

    // Función para enviar formulario
    const handleSubmit = async (e) => {
        if (isRegistering) {
            handleSubmitRegistration(e);
        } else {
            handleSubmitLogin(e);
        }
    };

    // Función para interrumpir la reproducción de audio
    const stopCurrentAudio = () => {
        if (isPlayingRef.current) {
            // Limpiar la cola de audio
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            
            // Crear un contexto de audio temporal y desconectarlo para detener cualquier sonido
            const tempContext = new (window.AudioContext || window.webkitAudioContext)();
            tempContext.close();
        }
    };

    // Función para guardar el último mensaje reproducido
    const saveLastMessage = (messageKey) => {
        lastMessageRef.current = messageKey;
        try {
            localStorage.setItem(LAST_MESSAGE_KEY, messageKey);
        } catch (e) {
            console.error('Error al guardar mensaje en localStorage:', e);
        }
    };

    // Función para reproducir mensajes de audio en cola
    const playNextInQueue = async () => {
        if (audioQueueRef.current.length === 0 || isPlayingRef.current) {
            return;
        }

        isPlayingRef.current = true;
        const nextMessage = audioQueueRef.current.shift();

        try {
            // Guardar el mensaje actual como el último reproducido
            saveLastMessage(nextMessage);
            await playPredefinedMessage(nextMessage);
        } catch (error) {
            console.error(`Error al reproducir mensaje ${nextMessage}:`, error);
            setAudioError(true);
        } finally {
            isPlayingRef.current = false;
            // Reproducir el siguiente mensaje en la cola
            setTimeout(playNextInQueue, 100);
        }
    };

    // Función para añadir un mensaje a la cola de reproducción
    const queueAudioMessage = (messageKey) => {
        audioQueueRef.current.push(messageKey);
        playNextInQueue();
    };

    // Función para repetir el último mensaje
    const repeatLastMessage = () => {
        let messageToRepeat = lastMessageRef.current;
        
        // Si no hay mensaje en la referencia, intentar obtenerlo del localStorage
        if (!messageToRepeat) {
            try {
                messageToRepeat = localStorage.getItem(LAST_MESSAGE_KEY);
            } catch (e) {
                console.error('Error al obtener mensaje de localStorage:', e);
            }
        }
        
        // Si se encontró un mensaje para repetir, reproducirlo
        if (messageToRepeat) {
            queueAudioMessage(messageToRepeat);
        }
    };

    // Función para reproducir un mensaje con respaldo de síntesis de voz
    const playWithFallback = (messageKey, fallbackText) => {
        try {
            // Primero verificar si el audio existe
            fetch(`${window.location.origin}/audio/${messageKey}.mp3`, { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        console.log(`Reproduciendo audio ${messageKey} desde archivo...`);
                        queueAudioMessage(messageKey);
                    } else {
                        console.log(`Audio ${messageKey} no encontrado, usando síntesis de voz...`);
                        // Si no existe el archivo, usar síntesis de voz como respaldo
                        try {
                            const msg = new SpeechSynthesisUtterance();
                            msg.text = fallbackText;
                            msg.lang = 'es-ES';
                            msg.rate = 0.9; // Velocidad ligeramente más lenta para mejor comprensión
                            window.speechSynthesis.speak(msg);
                        } catch (synthError) {
                            console.error(`Error con síntesis de voz: ${synthError}`);
                        }
                    }
                })
                .catch(error => {
                    console.error(`Error al verificar audio ${messageKey}:`, error);
                });
        } catch (error) {
            console.error(`Error al reproducir mensaje ${messageKey}:`, error);
        }
    };

    // Función para manejar la interacción del usuario
    const handleUserInteraction = () => {
        if (!isInitialized && !hasPlayedWelcomeRef.current) {
            setIsInitialized(true);
            hasPlayedWelcomeRef.current = true;
            // Reproducir mensaje de bienvenida y luego preguntar si quiere iniciar sesión o registrarse
            queueAudioMessage(AUDIO_MESSAGES.welcome);
            setTimeout(() => {
                queueAudioMessage(AUDIO_MESSAGES.askLoginOrRegister);
            }, 2000); // Esperar 2 segundos después del mensaje de bienvenida
        }
    };

    // Añadir event listeners para cualquier interacción
    useEffect(() => {
        const events = ['click', 'touchstart'];
        events.forEach(event => {
            window.addEventListener(event, handleUserInteraction, { once: true });
        });

        // Añadir listener para las teclas espacio y enter
        const handleKeyPress = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (isPlayingRef.current) {
                    // Si está reproduciendo audio, detenerlo
                    stopCurrentAudio();
                } else if (!isListening && !showBrailleInput) {
                    // Solo iniciar reconocimiento si no está el braille activo
                    handleStartListening();
                }
            } else if (e.code === 'Enter') {
                e.preventDefault();
                // Repetir el último mensaje
                repeatLastMessage();
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleUserInteraction);
            });
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [isListening, showBrailleInput]);

    const handleStartListening = async () => {
        console.log('🎙️ Iniciando reconocimiento de voz...');
        
        // No iniciar reconocimiento si se está mostrando la interfaz de braille
        if (showBrailleInput) {
            console.log('⚠️ No se puede iniciar el reconocimiento mientras está activa la interfaz de braille');
            return;
        }
        
        // Verificar si hay audio reproduciéndose antes de iniciar el reconocimiento
        if (isPlayingRef.current) {
            console.log('⚠️ No se puede iniciar el reconocimiento de voz mientras se reproduce un audio');
            return;
        }
        
        setIsListening(true);
        setError('');
        setTranscript('');
        finalTranscriptRef.current = '';
        
        // Si estamos en modo registro, mostrar un mensaje visual de ayuda
        if (isRegistering) {
            // Mostrar un mensaje visual de ayuda
            setTranscript('Esperando que digas tu información...');
            
        }
        
        try {
            const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.lang = 'es-ES';
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.maxAlternatives = 5; // Obtener más alternativas
            
            // Log de configuración
            console.log('Configuración del reconocimiento:', {
                lang: recognition.lang,
                continuous: recognition.continuous,
                interimResults: recognition.interimResults,
                maxAlternatives: recognition.maxAlternatives
            });

            // Variable para rastrear la actividad de voz
            let silenceDetectionInterval = null;
            let lastSpeechTime = Date.now();
            let hasDetectedSpeech = false;
            let currentTranscript = '';
            
            // Bandera para rastrear si ya se procesó el texto
            let hasProcessedSpeech = false;

            // Función para procesar el texto y evitar múltiples procesamientos
            const processSpeechText = (text) => {
                if (hasProcessedSpeech || !text) return;
                
                console.log('🔄 Procesando texto final:', text);
                finalTranscriptRef.current = text;
                speechProcessor.processUserSpeech(text, isRegistering, showVoiceLogin, showFaceLogin);
                hasProcessedSpeech = true;
            };

            // Función para detectar silencio
            const checkForSilence = () => {
                const silenceTime = Date.now() - lastSpeechTime;
                
                // Log para depuración de silencio
                if (hasDetectedSpeech && silenceTime > 500) {
                    console.log(`Silencio detectado: ${silenceTime}ms`);
                }
                
                if (silenceTime >= 1000 && hasDetectedSpeech && !hasProcessedSpeech) {
                    console.log('🔊 Silencio detectado después de 1 segundo. Finalizando reconocimiento.');
                    console.log('🔤 Texto final reconocido:', currentTranscript);
                    
                    clearInterval(silenceDetectionInterval);
                    
                    // Procesar inmediatamente lo que dijo el usuario
                    processSpeechText(currentTranscript);
                    
                    // Detener el reconocimiento
                    try {
                        recognition.stop();
                        console.log('Reconocimiento detenido correctamente');
                    } catch (e) {
                        console.error('Error al detener el reconocimiento:', e);
                    }
                }
            };

            recognition.onstart = () => {
                console.log('🎙️ Reconocimiento de voz iniciado');
            };

            recognition.onresult = (event) => {
                console.log('Resultado recibido:', event);
                const current = event.resultIndex;
                const result = event.results[current];
                currentTranscript = result[0].transcript.toLowerCase();
                
                // Mostrar todas las alternativas si están disponibles
                if (result.length > 1) {
                    console.log('Alternativas disponibles:');
                    for (let i = 0; i < result.length; i++) {
                        console.log(`  ${i+1}: ${result[i].transcript} (confianza: ${result[i].confidence})`);
                    }
                }
                
                // Actualizar el transcript en tiempo real para mostrar lo que se está reconociendo
                setTranscript(currentTranscript);
                console.log('Reconocido:', currentTranscript);
                lastSpeechTime = Date.now();
                hasDetectedSpeech = true;
            };

            recognition.onend = () => {
                console.log('🛑 Reconocimiento finalizado');
                clearInterval(silenceDetectionInterval);
                setIsListening(false);
                
                // Si no se ha procesado el texto y tenemos algo que procesar, hacerlo ahora
                if (!hasProcessedSpeech && currentTranscript) {
                    console.log('⚠️ Reconocimiento finalizado sin detectar silencio. Procesando último texto conocido:', currentTranscript);
                    processSpeechText(currentTranscript);
                }
            };

            recognition.onerror = (event) => {
                console.log('❌ Error en reconocimiento:', event.error);
                clearInterval(silenceDetectionInterval);
                if (event.error === 'no-speech') {
                    setError('No se detectó voz. Por favor, intenta hablar de nuevo.');
                } else {
                    setError(`Error en el reconocimiento de voz: ${event.error}`);
                }
                setIsListening(false);
            };

            recognition.onnomatch = () => {
                console.log('❓ No se encontró coincidencia para el habla');
            };

            recognition.start();
            console.log('Reconocimiento de voz iniciado correctamente');
        } catch (error) {
            console.error('❌ Error al iniciar reconocimiento de voz:', error);
            setError('Tu navegador no soporta el reconocimiento de voz');
            setIsListening(false);
        }
    };

    // Añadir un efecto para monitorear cambios en los estados principales
    useEffect(() => {
        console.log('🔄 CAMBIO DE ESTADO DETECTADO:');
        console.log('isRegistering:', isRegistering);
        console.log('showVoiceLogin:', showVoiceLogin);
        console.log('showFaceLogin:', showFaceLogin);
    }, [isRegistering, showVoiceLogin, showFaceLogin]);

    // Función para actualizar estados y garantizar re-renderizado
    const updateAppState = (action) => {
        console.log('⚙️ Actualizando estado:', action);
        
        // Guardar estado anterior para comparar
        const prevState = {
            isRegistering,
            showVoiceLogin,
            showFaceLogin,
            isLoggingIn
        };
        
        switch (action) {
            case 'login':
                setIsRegistering(false);
                setShowVoiceLogin(false);
                setShowFaceLogin(false);
                setIsLoggingIn(true);
                // Reproducir audio después de un breve retraso para asegurar que el DOM esté actualizado
                setTimeout(() => {
                    console.log('Reproduciendo audio de login...');
                    queueAudioMessage(AUDIO_MESSAGES.login);
                }, 200);
                break;
            case 'register':
                console.log('🔔 ACTIVANDO MODO REGISTRO');
                setIsRegistering(true);
                setShowVoiceLogin(false);
                setShowFaceLogin(false);
                setIsLoggingIn(false);
                
                // Reproducir audio de registro de forma más fiable
                setTimeout(() => {
                    console.log('Reproduciendo secuencia de audio para registro...');
                    try {
                        // Detener cualquier audio previo
                        stopCurrentAudio();
                        
                        // Reproducir audio de registro una sola vez
                        setTimeout(() => {
                            console.log('Reproduciendo audio register...');
                            queueAudioMessage(AUDIO_MESSAGES.register);
                            
                            // Esperar a que termine el primer audio y reproducir instrucciones claras
                            setTimeout(() => {
                                console.log('Reproduciendo instrucciones detalladas de registro...');
                                
                                // Usar archivos de audio existentes en lugar de síntesis de voz
                                console.log('Reproduciendo guía de voz para registro...');
                                queueAudioMessage(AUDIO_MESSAGES.registerVoiceGuide);
                                
                                // Programar reproducción de instrucciones adicionales para solicitar el nombre de usuario
                                setTimeout(() => {
                                    console.log('Solicitando nombre de usuario...');
                                    queueAudioMessage(AUDIO_MESSAGES.askUserName);
                                    
                                    // Añadir un indicador visual después de las instrucciones
                                    setTimeout(() => {
                                        const formHeader = document.createElement('div');
                                        formHeader.className = 'mt-4 p-3 bg-blue-100 rounded-md text-center';
                                        formHeader.innerHTML = `
                                            <p class="text-blue-800 font-medium">Ingrese los datos para su registro</p>
                                            <p class="text-blue-600 text-sm mt-1">Complete los campos en el formulario</p>
                                            <p class="text-blue-600 text-sm mt-1 font-bold">Presione el botón "Hablar para registrarse" cuando esté listo</p>
                                        `;
                                        
                                        // Insertar al principio del formulario
                                        const form = document.querySelector('form');
                                        if (form && form.firstChild) {
                                            form.insertBefore(formHeader, form.firstChild);
                                        }
                                        
                                        // Ya no iniciaremos automáticamente el reconocimiento de voz
                                        // El usuario debe presionar el botón explícito para activarlo
                                    }, 1000);
                                }, 2000);
                            }, 2000);
                        }, 300);
                    } catch (error) {
                        console.error('Error al reproducir audio de registro:', error);
                    }
                }, 500);
                
                // Forzar refresco de la UI después de un breve retraso
                setTimeout(() => {
                    console.log('Estado verificado después de cambio:', {
                        isRegistering,
                        showVoiceLogin,
                        showFaceLogin,
                        isLoggingIn
                    });
                }, 300);
                break;
            case 'voiceLogin':
                setIsRegistering(false);
                setShowVoiceLogin(true);
                setShowFaceLogin(false);
                setIsLoggingIn(false);
                setTimeout(() => {
                    queueAudioMessage(AUDIO_MESSAGES.voiceLogin);
                }, 200);
                break;
            case 'faceLogin':
                setIsRegistering(false);
                setShowVoiceLogin(false);
                setShowFaceLogin(true);
                setIsLoggingIn(false);
                setTimeout(() => {
                    queueAudioMessage(AUDIO_MESSAGES.faceLogin);
                }, 200);
                break;
            case 'backToMain':
                setIsRegistering(false);
                setShowVoiceLogin(false);
                setShowFaceLogin(false);
                setIsLoggingIn(false);
                setTimeout(() => {
                    queueAudioMessage(AUDIO_MESSAGES.askLoginOrRegister);
                }, 200);
                break;
            default:
                console.log('Acción desconocida:', action);
                return; // No hay cambio de estado
        }
        
        // Programar verificación de cambio de estado
        setTimeout(() => {
            const newState = {
                isRegistering,
                showVoiceLogin,
                showFaceLogin,
                isLoggingIn
            };
            
            // Comparar estados para verificar cambio
            if (JSON.stringify(prevState) === JSON.stringify(newState)) {
                console.warn('⚠️ ALERTA: Estado no cambió después de acción:', action);
                console.log('Estado antes:', prevState);
                console.log('Estado después:', newState);
                
                // Forzar actualización explícita
                switch (action) {
                    case 'register':
                        console.log('🔄 Forzando cambio a modo registro');
                        setIsRegistering(prev => !prev); // Toggle para forzar cambio
                        setTimeout(() => {
                            setIsRegistering(true);
                            // NO reproducir audio nuevamente después del cambio forzado
                            // Se eliminó la siguiente sección para evitar duplicación:
                            // setTimeout(() => {
                            //     queueAudioMessage(AUDIO_MESSAGES.register);
                            // }, 300);
                        }, 50); // Restaurar valor deseado
                        break;
                    case 'voiceLogin':
                        setShowVoiceLogin(prev => !prev);
                        setTimeout(() => {
                            setShowVoiceLogin(true);
                            setTimeout(() => queueAudioMessage(AUDIO_MESSAGES.voiceLogin), 300);
                        }, 50);
                        break;
                    case 'faceLogin':
                        setShowFaceLogin(prev => !prev);
                        setTimeout(() => {
                            setShowFaceLogin(true);
                            setTimeout(() => queueAudioMessage(AUDIO_MESSAGES.faceLogin), 300);
                        }, 50);
                        break;
                    case 'login':
                        setIsLoggingIn(prev => !prev);
                        setTimeout(() => {
                            setIsLoggingIn(true);
                            setTimeout(() => queueAudioMessage(AUDIO_MESSAGES.login), 300);
                        }, 50);
                        break;
                    default:
                        // No se requiere acción especial
                        break;
                }
            } else {
                console.log('✅ Estado cambiado correctamente a:', newState);
            }
        }, 200);
    };

    // Función para procesar el texto reconocido
    const processUserSpeech = (text) => {
        console.log('===================== PROCESANDO TEXTO =====================');
        console.log('Texto recibido:', text);
        console.log('Estado actual - isRegistering:', isRegistering);
        console.log('Estado actual - showVoiceLogin:', showVoiceLogin);
        console.log('Estado actual - showFaceLogin:', showFaceLogin);
        
        if (!text) {
            console.log('⚠️ No hay texto para procesar');
            return;
        }
        
        // Normalizar el texto para facilitar la detección de comandos
        const normalizedText = text.toLowerCase().trim();
        
        // Función para verificar si el texto contiene alguna de las palabras clave
        const containsAny = (keywords) => {
            return keywords.some(keyword => normalizedText.includes(keyword));
        };
        
        // Si estamos en modo registro, verificar si el usuario está proporcionando datos
        if (isRegistering) {
            console.log('🧩 Procesando input durante registro');
            
            // Patrones para reconocer datos de registro
            const usernamePattern1 = /mi nombre (de usuario )?es\s+([a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]+)/i;
            const usernamePattern2 = /([a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]+)\s+es mi nombre/i;
            const usernamePattern3 = /me llamo\s+([a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]+)/i;
            const emailPattern3 = /mi (correo|email|mail|e-mail|dirección)( electrónico)? es ([a-zA-Z0-9]+)( guion bajo| guión bajo| underscore)([a-zA-Z0-9]+) arroba ([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
            
            // Verificar si está diciendo su nombre de usuario
            let match;
            if ((match = normalizedText.match(usernamePattern1))) {
                const extractedUsername = match[2];
                console.log('✅ Nombre de usuario reconocido (patrón 1):', extractedUsername);
                setUsername(extractedUsername);
                queueAudioMessage(AUDIO_MESSAGES.userNameConfirmed);
                setTimeout(() => {
                    playWithFallback("askEmail", "Por favor, dime tu correo electrónico.");
                }, 2000);
                return;
            } else if ((match = normalizedText.match(usernamePattern2))) {
                const extractedUsername = match[1];
                console.log('✅ Nombre de usuario reconocido (patrón 2):', extractedUsername);
                setUsername(extractedUsername);
                queueAudioMessage(AUDIO_MESSAGES.userNameConfirmed);
                setTimeout(() => {
                    playWithFallback("askEmail", "Por favor, dime tu correo electrónico.");
                }, 2000);
                return;
            } else if ((match = normalizedText.match(usernamePattern3))) {
                const extractedUsername = match[1];
                console.log('✅ Nombre de usuario reconocido (patrón 3):', extractedUsername);
                setUsername(extractedUsername);
                queueAudioMessage(AUDIO_MESSAGES.userNameConfirmed);
                setTimeout(() => {
                    playWithFallback("askEmail", "Por favor, dime tu correo electrónico.");
                }, 2000);
                return;
            }
            
            // Si el texto es muy corto y está en modo de registro, probablemente sea solo el nombre
            if (normalizedText.length > 2 && normalizedText.length < 20 && !normalizedText.includes(' ')) {
                console.log('✅ Posible nombre de usuario directo:', normalizedText);
                setUsername(normalizedText);
                queueAudioMessage(AUDIO_MESSAGES.userNameConfirmed);
                setTimeout(() => {
                    playWithFallback("askEmail", "Por favor, dime tu correo electrónico.");
                }, 2000);
                return;
            }
            const letterToCharMap = {
                a: 'a', be: 'b', ce: 'c', de: 'd', e: 'e', efe: 'f', ge: 'g',
                hache: 'h', i: 'i', jota: 'j', ka: 'k', ele: 'l', eme: 'm', ene: 'n',
                eñe: 'ñ', o: 'o', pe: 'p', cu: 'q', ere: 'r', ese: 's', te: 't',
                u: 'u', ve: 'v', uve: 'v', 'doble ve': 'w', equis: 'x', ye: 'y', zeta: 'z',
                'i griega': 'y', cero: '0', uno: '1', dos: '2', tres: '3', cuatro: '4',
                cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
              };
              
              const specialMap = {
                'guion bajo': '_', 'guión bajo': '_', underscore: '_',
                'guion medio': '-', 'guión medio': '-', menos: '-',
                punto: '.', dot: '.', arroba: '@',
              };
              
              function normalizeSpokenEmail(text) {
                let processed = text.toLowerCase();
              
                for (const [key, val] of Object.entries(specialMap)) {
                  processed = processed.replaceAll(key, ` ${val} `);
                }
              
                const words = processed.split(/\s+/).filter(Boolean);
                const emailParts = words.map(w => letterToCharMap[w] || w).join('');
                return emailParts;
              }
              
              function confirmEmail(email) {
                setEmail(email);
                queueAudioMessage(AUDIO_MESSAGES.emailConfirmed);
                queueAudioMessage(AUDIO_MESSAGES.passwordConfirmed);
              
                let verbalEmail = '';
                for (const char of email) {
                  verbalEmail += {
                    '@': ' arroba ',
                    '.': ' punto ',
                    '_': ' guion bajo ',
                    '-': ' guion medio ',
                  }[char] || char + ' ';
                }
              
                if (isListening) handleStopListening();
                setShowBrailleInput(true);
                console.log('✅ Correo confirmado y se activa interfaz de braille:', email);
              }
              
              function handleEmailRecognition(normalizedText) {
                const spokenText = normalizeSpokenEmail(normalizedText);
                const emailRegex = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
                const match = spokenText.match(emailRegex);
              
                if (match) {
                  const email = `${match[1]}@${match[2]}`;
                  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    confirmEmail(email);
                  } else {
                    console.warn('❌ Email inválido después de procesar:', email);
                  }
                } else {
                  console.log('⚠️ Texto no contiene email reconocido:', spokenText);
                }
              }
              handleEmailRecognition(normalizedText);
        }
        
        // Procesar comandos de navegación general
        // Palabras clave para cada acción
        const registerKeywords = ['registrar', 'registro', 'crear cuenta', 'nueva cuenta', 'inscribirme', 
                                'registrarme', 'inscribir', 'registra', 'registrame', 'inscribirte'];
        const loginKeywords = ['iniciar', 'login', 'entrar', 'sesión', 'iniciar sesión', 'entrar sesión', 
                               'inicia', 'ingreso', 'ingresar', 'acceder', 'acceso'];
        const voiceKeywords = ['voz', 'reconocimiento de voz', 'hablar', 'por voz'];
        const faceKeywords = ['cara', 'facial', 'reconocimiento facial', 'rostro', 'mi cara', 'fotografía'];
        const cancelKeywords = ['cancelar', 'volver', 'regresar', 'atrás', 'salir', 'cancela'];
        
        console.log('Analizando comando en texto normalizado:', normalizedText);
        
        // Procesar comandos de navegación general primero, independientemente del estado actual
        if (containsAny(loginKeywords)) {
            console.log('✅ Comando reconocido: iniciar sesión');
            updateAppState('login');
            return;
        } 
        
        if (containsAny(registerKeywords)) {
            console.log('✅ Comando reconocido: registrarse');
            console.log('Palabras clave detectadas: registrar, registro, crear cuenta, etc.');
            updateAppState('register');
            return;
        } 
        
        if (containsAny(voiceKeywords)) {
            console.log('✅ Comando reconocido: login por voz');
            updateAppState('voiceLogin');
            return;
        } 
        
        if (containsAny(faceKeywords)) {
            console.log('✅ Comando reconocido: login facial');
            updateAppState('faceLogin');
            return;
        }

        // Si llegamos aquí, no fue un comando de navegación principal
        // Ahora procesamos comandos específicos del estado actual
        if (isRegistering || showVoiceLogin || showFaceLogin) {
            if (containsAny(cancelKeywords)) {
                console.log('✅ Comando reconocido: cancelar/volver');
                updateAppState('backToMain');
                return;
            }
        }
        
        // Si llegamos aquí, no se reconoció ningún comando
        console.log('❌ Comando no reconocido');
        console.log('Comandos disponibles: "iniciar sesión", "registrarse", "voz", "facial", "cancelar"');
    };

    const handleStopListening = () => {
        setIsListening(false);
        if (window.SpeechRecognition || window.webkitSpeechRecognition) {
            try {
                const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                recognition.stop();
            } catch (error) {
                console.error('Error al detener reconocimiento:', error);
            }
        }
    };

    // Funciones para grabación de voz
    const handleVoiceRecordingComplete = (audioBlob) => {
        // Verificar si ya tenemos un audioBlob para evitar procesamiento duplicado
        if (voiceRegisteredRef.current) {
            console.log('⚠️ La grabación de voz ya fue completada anteriormente, ignorando llamada duplicada');
            return;
        }

        // Marcar como registrado para evitar repeticiones
        voiceRegisteredRef.current = true;
        setVoiceRegistrationComplete(true);
        setRegistrationStep('voice');
        
        // Guardar el audioBlob
        setAudioBlob(audioBlob);
        
        // Registro de datos sobre el audio grabado
        const audioBlobSizeKB = (audioBlob.size / 1024).toFixed(2);
        console.log("\n%c========== DATOS DE GRABACIÓN DE VOZ ==========", "color: #4CAF50; font-weight: bold; font-size: 14px;");
        console.log("%cTamaño: %c" + audioBlobSizeKB + " KB", "color: #2196F3; font-weight: bold", "color: #000; font-weight: normal");
        console.log("%cTipo: %c" + audioBlob.type, "color: #2196F3; font-weight: bold", "color: #000; font-weight: normal");
        console.log("%cHora: %c" + new Date().toLocaleTimeString(), "color: #2196F3; font-weight: bold", "color: #000; font-weight: normal");
        console.log("%c===============================================", "color: #4CAF50; font-weight: bold; font-size: 14px;");

        // Detener cualquier audio pendiente antes de reproducir el nuevo
        stopCurrentAudio();
        
        // Crear una función para activar la cámara después de un tiempo
        const activateCameraAfterDelay = () => {
            // Verificar si ya hemos llegado a la etapa de captura facial
            if (registrationStep !== 'face') {
                setRegistrationStep('face');
            }
            
            console.log('🎥 Intentando activar cámara automáticamente...');
            
            // Buscar el botón de cámara directamente por su ID (más fiable)
            const cameraButton = document.getElementById('iniciarCamaraBtn');
            
            if (cameraButton) {
                console.log('✅ Botón de cámara encontrado por ID. Activando captura facial automáticamente...');
                // Introducir un pequeño retraso para asegurar que el DOM está listo
                setTimeout(() => {
                    cameraButton.click();
                    console.log('✅ Clic en botón de cámara ejecutado');
                }, 100);
            } else {
                console.warn('⚠️ No se encontró el botón por ID, intentando con selectores alternativos...');
                
                // Fallback: intentar con otros selectores si el ID falla
                const fallbackSelectors = [
                    'button.bg-blue-600:not(.record-button)',
                    'button[data-testid="camera-button"]'
                ];
                
                let buttonFound = false;
                
                for (const selector of fallbackSelectors) {
                    const button = document.querySelector(selector);
                    if (button) {
                        console.log(`✅ Botón de cámara encontrado con selector: ${selector}`);
                        setTimeout(() => {
                            button.click();
                            console.log('✅ Clic en botón de cámara ejecutado');
                        }, 100);
                        buttonFound = true;
                        break;
                    }
                }
                
                // Si aún no lo encontramos, buscar por texto
                if (!buttonFound) {
                    const allButtons = document.querySelectorAll('button');
                    for (const button of allButtons) {
                        if (button.textContent.trim() === 'Iniciar Cámara') {
                            console.log('✅ Botón de cámara encontrado por texto');
                            setTimeout(() => {
                                button.click();
                                console.log('✅ Clic en botón de cámara ejecutado');
                            }, 100);
                            buttonFound = true;
                            break;
                        }
                    }
                }
                
                if (!buttonFound) {
                    console.error('❌ No se pudo encontrar el botón de cámara con ningún método');
                }
            }
        };
        
        // Esperar un momento antes de reproducir el mensaje de éxito
        setTimeout(() => {
            // Reproducir mensaje de éxito
            setPlayingAudio(true);
            queueAudioMessage(AUDIO_MESSAGES.loginSuccess);
            
            // Esperar a que termine el audio de éxito antes de reproducir instrucciones para la captura facial
            setTimeout(() => {
                // Asegurarse de que no se active el micrófono nuevamente
                if (registrationStep === 'voice') {
                    console.log('🔊 Reproduciendo mensaje para captura facial...');
                    
                    // Instrucciones para la captura facial
                    playWithFallback('faceCapture', 'Ahora activaré la cámara para capturar tu rostro. Por favor, colócate frente a la cámara, mantén el rostro estable y con buena iluminación. La foto se tomará automáticamente cuando se detecte estabilidad.');
                    
                    // Esperar a que termine el audio antes de activar la cámara
                    setTimeout(activateCameraAfterDelay, 4000); // Dar tiempo suficiente para que termine el audio
                }
            }, 2500); // Esperar 2.5 segundos después del mensaje de éxito
        }, 500);
    };

    const handleStartRecording = () => {
        setIsRecording(true);
    };

    const handleStopRecording = () => {
        setIsRecording(false);
    };

    // Funciones para login con voz
    const handleVoiceLoginSuccess = (token, user) => {
        console.log('Login con voz exitoso:', token, user);
        
        if (!token || !user) {
            setError('Datos de autenticación incompletos');
            queueAudioMessage(AUDIO_MESSAGES.loginError);
            return;
        }
        
        login({
            token: token,
            username: user.username,
            email: user.email
        });
        queueAudioMessage(AUDIO_MESSAGES.loginSuccess);
        setTimeout(() => navigate('/home'), 2000);
    };

    // Funciones para captura facial
    const handlePhotoComplete = (blob) => {
        setPhotoBlob(blob);
    };

    const handleStartCapture = () => {
        setIsCapturing(true);
    };

    const handleStopCapture = () => {
        setIsCapturing(false);
    };

    // Función para enviar formulario
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Imprimir los datos del formulario en la consola
        console.log('Datos del formulario enviado:', {
            username,
            email,
            password,
            isRegistering,
            tieneAudioBiometrico: !!audioBlob,
            tieneFotoBiometrica: !!photoBlob
        });

        // Validar campos
        if (isRegistering) {
            if (!username || !email || !password) {
                setError('Por favor completa todos los campos');
                return;
            }

            const formData = new FormData();
            formData.append('username', username);
            formData.append('email', email);
            formData.append('password', password);


            if(audioBlob){
                formData.append('voice_recording', audioBlob, 'voice.wav');
            }
            
            if (photoBlob) {
                formData.append('face_photo', photoBlob, 'face.jpg');
            }

            try {
                const response = await fetch(`${config.API_URL}/auth/register`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Error en el registro');
                }

                const data = await response.json();
                setSuccess('Registro exitoso. Por favor, inicia sesión.');
                queueAudioMessage(AUDIO_MESSAGES.loginSuccess);
                setIsRegistering(false);
                setEmail('');
                setPassword('');
                setUsername('');
                setAudioBlob(null);
                setPhotoBlob(null);
            } catch (err) {
                console.error('Error en el registro:', err);
                setError('Error al conectar con el servidor');
                queueAudioMessage(AUDIO_MESSAGES.loginError);
            }
        } else {
            if (!username || !password) {
                setError('Por favor completa todos los campos');
                return;
            }

            try {
                const loginData = new URLSearchParams({username, password});
                
                const response = await fetch(`${config.API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: loginData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Error en el inicio de sesión');
                }

                const data = await response.json();
                
                if (!data.access_token) {
                    throw new Error('No se recibió token en la respuesta');
                }

                const loginDataToSend = {
                    token: data.access_token,
                    username: data.username || username,
                    email: data.email || email
                };

                login(loginDataToSend);
                queueAudioMessage(AUDIO_MESSAGES.loginSuccess);
                setTimeout(() => navigate('/home'), 2000);
            } catch (err) {
                console.error('Error en el inicio de sesión:', err);
                setError('Error al conectar con el servidor');
                queueAudioMessage(AUDIO_MESSAGES.loginError);
            }
        }
    };

    // Modificar el useEffect que reproduce la bienvenida al cargar el componente
    useEffect(() => {
        console.log('🎙️ Inicializando componente de login accesible');
        
        // No reproducir automáticamente el mensaje de bienvenida
        // La reproducción se manejará a través de handleUserInteraction después de la primera interacción
        
    }, []);

    return (
        
        <div 
            className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-white py-12 px-4 sm:px-6 lg:px-8"
            onClick={handleUserInteraction}
            onTouchStart={handleUserInteraction}
            tabIndex={0}
            role="button"
            aria-label="Activar asistente vocal"
        >
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        {isRegistering 
                            ? 'Crear cuenta accesible' 
                            : isLoggingIn 
                                ? 'Iniciar sesión accesible'
                                : 'Acceso accesible por voz'}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Sistema de acceso para personas con discapacidad visual
                    </p>
                    
                    {/* ✅ MENSAJE DE REGISTRO EXITOSO */}
                    {wasRegistered && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-center">
                        ✅ Registro exitoso. Ahora puedes iniciar sesión.
                    </div>
                    )}
                    {!isInitialized && (
                        <p className="mt-4 text-center text-sm text-indigo-600 animate-pulse">
                            Toca cualquier parte de la pantalla para comenzar
                        </p>
                    )}
                    {isInitialized && !isListening && (
                        <div className="mt-4 text-center text-sm text-indigo-600 space-y-2">
                            <p>
                                Presiona la tecla <span className="font-bold">espacio</span> para activar el asistente
                            </p>
                            <p>
                                Presiona <span className="font-bold">enter</span> para repetir el último mensaje
                            </p>
                            <p>
                                Presiona <span className="font-bold">espacio</span> durante un audio para interrumpirlo
                            </p>
                        </div>
                    )}
                </div>

                {!showVoiceLogin && !showFaceLogin ? (
                    showBrailleInput ? (
                        <div className="mt-8 braille-container">
                            <h3 className="text-lg font-medium text-center text-blue-800 mb-4">
                                Creación de contraseña mediante Braille
                            </h3>
                            <p className="text-sm text-center text-gray-600 mb-4">
                                Indica verbalmente los puntos del patrón braille para crear tu contraseña
                            </p>
                            <BraillePassword onPasswordComplete={handleBraillePasswordComplete} />
                        </div>
                    ) : (
                        <>
                            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                                <div className="rounded-md shadow-sm -space-y-px">
                                    {isRegistering && !isBrailleComplete && (
                                        <div>
                                            <label htmlFor="username" className="sr-only">
                                                Nombre de usuario
                                            </label>
                                            <input
                                                id="username"
                                                name="username"
                                                type="text"
                                                required
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                                placeholder="Nombre de usuario"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label htmlFor="email" className="sr-only">
                                            Correo electrónico
                                        </label>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${
                                                isRegistering && !isBrailleComplete ? 'rounded-none' : 'rounded-t-md'
                                            } focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                            placeholder="Correo electrónico"
                                        />
                                    </div>
                                    {(!isRegistering || !isBrailleComplete) && (
                                        <div>
                                            <label htmlFor="password" className="sr-only">
                                                Contraseña
                                            </label>
                                            <input
                                                id="password"
                                                name="password"
                                                type="password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                                placeholder="Contraseña"
                                            />
                                        </div>
                                    )}
                                </div>

                                {transcript && (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                                        <p className="text-sm text-gray-700">Texto reconocido: {transcript}</p>
                                    </div>
                                )}

                                {error && (
                                    <div className="text-red-500 text-sm text-center">
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="text-green-500 text-sm text-center">
                                        {success}
                                    </div>
                                )}

                                {audioError && (
                                    <div className="mt-4 p-4 bg-red-50 rounded-md">
                                        <p className="text-sm text-red-700">
                                            Error al reproducir audio. Por favor, verifica que los archivos de audio existan en la carpeta correcta.
                                        </p>
                                    </div>
                                )}

                                {isListening && (
                                    <div className="mt-4 p-4 bg-green-50 rounded-md">
                                        <p className="text-sm text-green-700">Escuchando... (se detendrá automáticamente después de 1 segundo de silencio)</p>
                                    </div>
                                )}

                                <div>
                                    <button
                                        type="submit"
                                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        {isRegistering ? 'Registrarse' : 'Iniciar sesión'}
                                    </button>
                                </div>
                            </form>

                            {isRegistering && !isBrailleComplete && !showBrailleInput && (
                                <div className="mt-8">
                                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <h3 className="text-lg font-semibold text-blue-800 mb-2">Modo de Registro</h3>
                                        <p className="text-sm text-blue-700 mb-2">
                                            Por favor, completa los campos del formulario para crear tu cuenta.
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            También puedes usar el asistente de voz para dictar tu información.
                                        </p>
                                    </div>
                                    
                                    {/* Botón explícito para activar reconocimiento de voz */}
                                    {!email && (
                                        <div className="mb-6">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!isPlayingRef.current && !isListening) {
                                                        handleStartListening();
                                                    } else if (isListening) {
                                                        handleStopListening();
                                                    }
                                                }}
                                                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium ${
                                                    isListening 
                                                        ? 'text-white bg-red-600 hover:bg-red-700' 
                                                        : 'text-white bg-green-600 hover:bg-green-700'
                                                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                                </svg>
                                                {isListening ? 'Detener reconocimiento' : 'Hablar para registrarse'}
                                            </button>
                                            <p className="mt-2 text-xs text-center text-gray-500">
                                                Presiona este botón cuando estés listo para hablar y proporcionar tus datos
                                            </p>
                                        </div>
                                    )}
                                    
                                    {email && (
                                        <div className="mt-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowBrailleInput(true)}
                                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                                            >
                                                Crear contraseña con Braille
                                            </button>
                                            <p className="mt-2 text-xs text-center text-gray-500">
                                                Crea una contraseña segura mediante el sistema braille
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!isRegistering && (
                                <div className="mt-6">
                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-gray-300"></div>
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                                            <span className="px-2 bg-white text-gray-500">Otras opciones</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => {
                                                updateAppState('voiceLogin');
                                            }}
                                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                        >
                                            Voz
                                        </button>
                                        <button
                                            onClick={() => {
                                                updateAppState('faceLogin');
                                            }}
                                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                        >
                                            Facial
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )
                ) : showFaceLogin ? (
                    <div className="mt-8">
                        <FaceLogin onLoginSuccess={handleVoiceLoginSuccess} />
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => {
                                    updateAppState('backToMain');
                                }}
                                className="text-sm text-indigo-600 hover:text-indigo-500"
                            >
                                Volver al login normal
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-8">
                        <VoiceLogin onLoginSuccess={handleVoiceLoginSuccess} />
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => {
                                    updateAppState('backToMain');
                                }}
                                className="text-sm text-indigo-600 hover:text-indigo-500"
                            >
                                Volver al login normal
                            </button>
                        </div>
  
                    </div>
                )}

                {isRegistering && isBrailleComplete && (
                    <div className="mt-8">
                        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h3 className="text-lg font-semibold text-blue-800 mb-2">Registro Biométrico (Opcional)</h3>
                            <p className="text-sm text-blue-700 mb-2">
                                Has registrado correctamente tu contraseña mediante braille.
                            </p>
                            <p className="text-sm text-blue-700">
                                Ahora puedes registrar tu voz y tu rostro para facilitar tus inicios de sesión futuros.
                            </p>
                        </div>
                        
                        <div className="text-center mb-4">
                            <p className="text-sm text-gray-600">Grabación de voz (opcional)</p>
                            <p className="text-xs text-gray-500">Te permitirá iniciar sesión usando tu voz en el futuro</p>
                        </div>
                        <VoiceRecorder
                            onRecordingComplete={handleVoiceRecordingComplete}
                            onStartRecording={handleStartRecording}
                            onStopRecording={handleStopRecording}
                        />
                        
                        <div className="mt-6">
                            <div className="text-center mb-4">
                                <p className="text-sm text-gray-600">Registro facial (opcional)</p>
                                <p className="text-xs text-gray-500">Te permitirá iniciar sesión usando reconocimiento facial</p>
                            </div>
                            <FaceRecorder
                                onPhotoComplete={handlePhotoComplete}
                                onStartCapture={handleStartCapture}
                                onStopCapture={handleStopCapture}
                            />
                        </div>
                        
                        <div className="mt-6">
                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                                Completar Registro
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {process.env.NODE_ENV !== 'production' && (
                <div className="fixed bottom-0 right-0 m-4 p-4 bg-black text-white text-xs rounded shadow-lg opacity-70">
                    <h4 className="font-bold mb-2">Estado actual:</h4>
                    <ul>
                        <li>isRegistering: {isRegistering ? '✅' : '❌'}</li>
                        <li>showVoiceLogin: {showVoiceLogin ? '✅' : '❌'}</li>
                        <li>showFaceLogin: {showFaceLogin ? '✅' : '❌'}</li>
                        <li>isLoggingIn: {isLoggingIn ? '✅' : '❌'}</li>
                        <li>isListening: {isListening ? '✅' : '❌'}</li>
                        <li>isInitialized: {isInitialized ? '✅' : '❌'}</li>
                    </ul>
                    <button 
                        onClick={() => updateAppState('register')} 
                        className="mt-2 mr-2 px-2 py-1 bg-purple-700 text-white rounded text-xs"
                    >
                        Forzar Registro
                    </button>
                    <button 
                        onClick={() => updateAppState('login')} 
                        className="mt-2 px-2 py-1 bg-blue-700 text-white rounded text-xs"
                    >
                        Forzar Login
                    </button>
                </div>
            )}
        </div>
    );
};

export default AccessibleLogin;