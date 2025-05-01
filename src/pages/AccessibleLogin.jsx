import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {playBeep, playPredefinedMessage } from '../services/audioService';
import { config } from '../config';
import VoiceRecorder from '../components/VoiceRecorder';
import FaceRecorder from '../components/FaceRecorder';
import FaceLogin from '../components/FaceLogin';
import BrailleLogin from '../components/BrailleLogin';
import BraillePasswordLogin from '../components/BraillePasswordLogin';
import BraillePassword from '../components/BraillePassword';
import { useLocation } from 'react-router-dom';;
import VoiceLoginRecorder from '../components/VoiceLoginRecorder';

// Claves de los mensajes de audio predefinidos
const AUDIO_MESSAGES = {
    welcome: "welcome",
    askRegistration: "askRegistration",
    registered: "registered",
    notRegistered: "notRegistered",
    listening: "listening",
    notUnderstood: "notUnderstood",
    goodbye: "goodbye",
    askLoginOrRegister: "askLoginOrRegister",
    login: "login",
    register: "register",
    voiceLogin: "voiceLogin",
    faceLogin: "faceLogin",
    loginSuccess: "loginSuccess",
    loginError: "loginError",
    registerInstructions: "registerInstructions",
    registerVoiceGuide: "registerVoiceGuide",
    askUserName: "askUserName",
    userNameConfirmed: "userNameConfirmed",
    emailConfirmed: "emailConfirmed",
    passwordConfirmed: "passwordPrompt", // Apuntando al audio correcto que sí existe
    braillePasswordSaved: "braillePasswordSaved",
    
    // Nuevos mensajes para la grabación de voz biométrica
    voiceRecordingPrompt: "voiceRecordingPrompt",
    voiceRecordingSample: "voiceRecordingSample", 
    voiceRecordingComplete: "voiceRecordingComplete",
    
    // Nuevo mensaje para la captura facial
    faceCapture: "faceCapture",
    emailHelp: "emailHelp",
    loginOptions: "loginOptions"
};

// Clave para almacenar el último mensaje en localStorage
const LAST_MESSAGE_KEY = 'accessibleLogin_lastAudioMessage';

// --- Agregar arrays de keywords globales ---
const voiceKeywords = ['vocal', 'reconocimiento vocal', 'hablar', 'por voz', 'reconocimiento de voz', 'voz'];
const faceKeywords = ['cara', 'facial', 'reconocimiento facial', 'rostro', 'mi cara', 'fotografía'];
const brailleKeywords = ['contraseña', 'braille', 'clave', 'password', 'escribir', 'teclear'];

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
    const [password, setPassword] = useState(''); // Asegura que existe este estado
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

    // Estados para login accesible
    const [loginStep, setLoginStep] = useState(null); // null, 'askMethod', 'askEmail', 'chooseMethod', 'braille', 'success', 'error'
    const [loginMethod, setLoginMethod] = useState(null); // 'voice', 'face', 'braille', null

    // Estados para mostrar el grabador de voz
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

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

    // Dentro de los estados en la parte superior del componente AccessibleLogin
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                processUserSpeech(text);
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
                startAccessibleLogin();
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
                            // setTimeout(() => queueAudioMessage(AUDIO_MESSAGES.register), 300);
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

    // ====================
    // FUNCION REUTILIZADA PARA DETECTAR EMAIL EN LOGIN Y REGISTRO
    // ====================
    const detectAndConfirmEmail = (normalizedText) => {
        // Patrones mejorados para reconocer correos electrónicos con frases introductorias
        const emailPattern1 = /mi (correo|email|mail|e-mail|dirección)( electrónico)? es ([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
        const emailPattern2 = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}) es mi (correo|email|mail|e-mail|dirección)( electrónico)?/i;

        let match;
        const playOptionsAudio = () => {
            // Reproduce un audio claro con las opciones disponibles
            queueAudioMessage(AUDIO_MESSAGES.emailConfirmed);
            setTimeout(() => {
                queueAudioMessage('loginOptions'); // Debes tener este audio generado, si no existe, se puede crear
            }, 1200);
        };
        if ((match = normalizedText.match(emailPattern1))) {
            const extractedEmail = `${match[3]}@${match[4]}`;
            console.log('✅ Correo electrónico reconocido (patrón 1):', extractedEmail);
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractedEmail)) {
                setEmail(extractedEmail);
                if (isListening) handleStopListening();
                if (loginStep !== 'chooseMethod') {
                    setLoginStep('chooseMethod');
                    playOptionsAudio();
                }
                return true;
            }
        } else if ((match = normalizedText.match(emailPattern2))) {
            const extractedEmail = `${match[1]}@${match[2]}`;
            console.log('✅ Correo electrónico reconocido (patrón 2):', extractedEmail);
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractedEmail)) {
                setEmail(extractedEmail);
                if (isListening) handleStopListening();
                if (loginStep !== 'chooseMethod') {
                    setLoginStep('chooseMethod');
                    playOptionsAudio();
                }
                return true;
            }
        }
        // Normalización adicional (hablado)
        const letterToCharMap = {
            a: 'a', be: 'b', ce: 'c', de: 'd', e: 'e', efe: 'f', ge: 'g',
            hache: 'h', i: 'i', jota: 'j', ka: 'k', ele: 'l', eme: 'm', ene: 'n',
            eñe: 'ñ', o: 'o', pe: 'p', cu: 'q', ere: 'r', ese: 's', te: 't',
            u: 'u', ve: 'v', uve: 'v', 'doble ve': 'w', equis: 'x', ye: 'y', zeta: 'z',
            'i griega': 'y', cero: '0', uno: '1', dos: '2', tres: '3', cuatro: '4',
            cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
            'veinticinco': '25', 'setenta y ocho': '78', 'treinta y cuatro': '34',
            'diez': '10', 'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14',
            'quince': '15', 'dieciséis': '16', 'diecisiete': '17', 'dieciocho': '18',
            'diecinueve': '19', 'veinte': '20', 'treinta': '30', 'cuarenta': '40',
            'cincuenta': '50', 'sesenta': '60', 'setenta': '70', 'ochenta': '80',
            'noventa': '90', 'cien': '100',
        };
        const specialMap = {
            'guion bajo': '_', 'guión bajo': '_', underscore: '_',
            'guion medio': '-', 'guión medio': '-', menos: '-',
            punto: '.', dot: '.', arroba: '@', 'at': '@',
            'a-': '@', 'a roba': '@', 'at sign': '@', 'a rroba': '@',
            'a rova': '@', 'arraba': '@', 'a-roba': '@',
            'a-rroba': '@', 'a-raba': '@',
        };
        function normalizeSpokenEmail(text) {
            let processed = text.toLowerCase();
            processed = processed.replace(/mi (correo|email|mail|e-mail|dirección)( electrónico)? es /i, '');
            processed = processed.replace(/ es mi (correo|email|mail|e-mail|dirección)( electrónico)?/i, '');
            for (const [key, val] of Object.entries(specialMap)) {
                processed = processed.replaceAll(key, ` ${val} `);
            }
            const words = processed.split(/\s+/).filter(Boolean);
            const emailParts = words.map(w => {
                if (/^[a-zA-Z0-9._-]+$/.test(w)) {
                    return w;
                }
                return letterToCharMap[w] || w;
            }).join('');
            console.log('Texto procesado para email:', processed);
            console.log('Email normalizado:', emailParts);
            sessionStorage.setItem('correovocal', emailParts);
            return emailParts;
        }
        const spokenText = normalizeSpokenEmail(normalizedText);
        const emailRegex = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const matchSpoken = spokenText.match(emailRegex);
        if (matchSpoken) {
            const email = `${matchSpoken[1]}@${matchSpoken[2]}`;
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                setEmail(email);
                if (isListening) handleStopListening();
                if (loginStep !== 'chooseMethod') {
                    setLoginStep('chooseMethod');
                    playOptionsAudio();
                }
                return true;
            }
        }
        return false;
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
        
        const normalizedText = text.toLowerCase().trim();
        const containsAny = (keywords) => keywords.some(keyword => normalizedText.includes(keyword));

        // 1. Si estamos en login (no registro), aún no hay email, y no estamos en métodos alternativos, primero intenta reconocer el email
        if (isLoggingIn && !email && !showVoiceLogin && !showFaceLogin && !showBrailleInput) {
            if (detectAndConfirmEmail(normalizedText)) {
                return; // Si reconoce el email, no sigue procesando comandos
            }
        }

        // 2. Si estamos en registro, procesa datos de registro (sin cambios)
        if (isRegistering) {
            // Patrones para reconocer datos de registro
            const usernamePattern1 = /mi nombre (de usuario )?es\s+([a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]+)/i;
            const usernamePattern2 = /([a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]+)\s+es mi nombre/i;
            const usernamePattern3 = /me llamo\s+([a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]+)/i;
            
            // Patrones mejorados para reconocer correos electrónicos con frases introductorias
            const emailPattern1 = /mi (correo|email|mail|e-mail|dirección)( electrónico)? es ([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
            const emailPattern2 = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}) es mi (correo|email|mail|e-mail|dirección)( electrónico)?/i;
            
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
            
            // Verificar si está diciendo su correo directamente
            if ((match = normalizedText.match(emailPattern1))) {
                const extractedEmail = `${match[3]}@${match[4]}`;
                console.log('✅ Correo electrónico reconocido (patrón 1):', extractedEmail);
                if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractedEmail)) {
                    setEmail(extractedEmail);
                    queueAudioMessage(AUDIO_MESSAGES.emailConfirmed);
                    queueAudioMessage(AUDIO_MESSAGES.passwordConfirmed);
                    if (isListening) handleStopListening();
                    setShowBrailleInput(true);
                    return;
                }
            } else if ((match = normalizedText.match(emailPattern2))) {
                const extractedEmail = `${match[1]}@${match[2]}`;
                console.log('✅ Correo electrónico reconocido (patrón 2):', extractedEmail);
                if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractedEmail)) {
                    setEmail(extractedEmail);
                    queueAudioMessage(AUDIO_MESSAGES.emailConfirmed);
                    queueAudioMessage(AUDIO_MESSAGES.passwordConfirmed);
                    if (isListening) handleStopListening();
                    setShowBrailleInput(true);
                    return;
                }
            }
            
            const letterToCharMap = {
                a: 'a', be: 'b', ce: 'c', de: 'd', e: 'e', efe: 'f', ge: 'g',
                hache: 'h', i: 'i', jota: 'j', ka: 'k', ele: 'l', eme: 'm', ene: 'n',
                eñe: 'ñ', o: 'o', pe: 'p', cu: 'q', ere: 'r', ese: 's', te: 't',
                u: 'u', ve: 'v', uve: 'v', 'doble ve': 'w', equis: 'x', ye: 'y', zeta: 'z',
                'i griega': 'y', cero: '0', uno: '1', dos: '2', tres: '3', cuatro: '4',
                cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
                // Añadir variantes para números
                'veinticinco': '25', 'setenta y ocho': '78', 'treinta y cuatro': '34',
                // Añadir números comunes
                'diez': '10', 'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14',
                'quince': '15', 'dieciséis': '16', 'diecisiete': '17', 'dieciocho': '18',
                'diecinueve': '19', 'veinte': '20', 'treinta': '30', 'cuarenta': '40',
                'cincuenta': '50', 'sesenta': '60', 'setenta': '70', 'ochenta': '80',
                'noventa': '90', 'cien': '100',
              };
              
              const specialMap = {
                'guion bajo': '_', 'guión bajo': '_', underscore: '_',
                'guion medio': '-', 'guión medio': '-', menos: '-',
                punto: '.', dot: '.', arroba: '@', 'at': '@',
                // Añadir más variantes para arroba
                'a-': '@', 'a roba': '@', 'at sign': '@', 'a rroba': '@',
                'a rova': '@', 'arraba': '@', 'a-roba': '@',
                'a-rroba': '@', 'a-raba': '@',
              };
              
              function normalizeSpokenEmail(text) {
                // Eliminar frases introductorias comunes
                let processed = text.toLowerCase();
                processed = processed.replace(/mi (correo|email|mail|e-mail|dirección)( electrónico)? es /i, '');
                processed = processed.replace(/ es mi (correo|email|mail|e-mail|dirección)( electrónico)?/i, '');
                
                // Reemplazar palabras especiales
                for (const [key, val] of Object.entries(specialMap)) {
                  processed = processed.replaceAll(key, ` ${val} `);
                }
                
                // Manejar espacios y separar palabras
                const words = processed.split(/\s+/).filter(Boolean);
                
                // Detectar y preservar partes alfanuméricas antes de mapear
                const emailParts = words.map(w => {
                  // Si es alfanumérico, preservarlo
                  if (/^[a-zA-Z0-9._-]+$/.test(w)) {
                    return w;
                  }
                  // Si es una letra o número hablado, mapearlo
                  return letterToCharMap[w] || w;
                }).join('');
                
                console.log('Texto procesado para email:', processed);
                console.log('Email normalizado:', emailParts);
                
                return emailParts;
              }
              
              function confirmEmail(email) {
                setEmail(email);
                
                // Usar solo mensajes de audio que sabemos que existen
                queueAudioMessage(AUDIO_MESSAGES.emailConfirmed);
                
                // Esperar un poco antes de reproducir el siguiente mensaje
                setTimeout(() => {
                  queueAudioMessage(AUDIO_MESSAGES.passwordConfirmed);
                }, 500);
              
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
                console.log('🔍 Analizando texto para email:', normalizedText);
                
                // Primero, eliminar espacios antes del @ para manejar casos como "usuario h 25@gmail.com"
                let processedText = normalizedText;
                const atIndex = processedText.indexOf('@');
                if (atIndex > 0) {
                  // Reemplazar espacios con nada en la parte del nombre de usuario
                  const usernamePart = processedText.substring(0, atIndex).replace(/\s+/g, '');
                  const domainPart = processedText.substring(atIndex);
                  processedText = usernamePart + domainPart;
                  console.log('🔄 Procesando email con espacios:', normalizedText, '→', processedText);
                }
                
                // Intentar extraer directamente un email completo
                const directEmailRegex = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
                const directMatch = processedText.match(directEmailRegex);
                
                if (directMatch) {
                  const email = `${directMatch[1]}@${directMatch[2]}`;
                  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    console.log('✅ Email reconocido directamente:', email);
                    confirmEmail(email);
                    return;
                  }
                }
                
                // Si no hay match directo, procesar el texto para reconocer partes del email
                const spokenText = normalizeSpokenEmail(normalizedText);
                const emailRegex = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
                const match = spokenText.match(emailRegex);
                
                if (match) {
                  const email = `${match[1]}@${match[2]}`;
                  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    console.log('✅ Email reconocido después de procesamiento:', email);
                    confirmEmail(email);
                  } else {
                    console.warn('❌ Email inválido después de procesar:', email);
                    // Intentar corregir errores comunes
                    let correctedEmail = email;
                    
                    // Corregir dominios comunes mal escritos
                    if (email.includes('@gmail')) correctedEmail = correctedEmail.replace(/@gmail[^.]*/, '@gmail.com');
                    if (email.includes('@hotmail')) correctedEmail = correctedEmail.replace(/@hotmail[^.]*/, '@hotmail.com');
                    if (email.includes('@yahoo')) correctedEmail = correctedEmail.replace(/@yahoo[^.]*/, '@yahoo.com');
                    if (email.includes('@outlook')) correctedEmail = correctedEmail.replace(/@outlook[^.]*/, '@outlook.com');
                    
                    if (correctedEmail !== email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correctedEmail)) {
                      console.log('✅ Email corregido automáticamente:', correctedEmail);
                      confirmEmail(correctedEmail);
                    }
                  }
                } else {
                  console.log('⚠️ Texto no contiene email reconocido:', spokenText);
                  
                  // Intentar extraer partes de un posible email
                  const usernamePart = /([a-zA-Z0-9._-]+)/i.exec(spokenText);
                  if (usernamePart && usernamePart[1].length > 3) {
                    console.log('⚠️ Posible nombre de usuario de email detectado:', usernamePart[1]);
                    // No confirmar automáticamente, solo mostrar mensaje de ayuda
                    queueAudioMessage(AUDIO_MESSAGES.askEmail || AUDIO_MESSAGES.notUnderstood);
                  }
                }
              }
              handleEmailRecognition(normalizedText);
        }
        
        // 3. Procesar comandos generales SOLO si no estamos capturando email
        const registerKeywords = ['registrar', 'registro', 'crear cuenta', 'nueva cuenta', 'inscribirme', 
                                'registrarme', 'inscribir', 'registra', 'registrame', 'inscribirte'];
        const loginKeywords = ['iniciar', 'login', 'entrar', 'sesión', 'iniciar sesión', 'entrar sesión', 
                               'inicia', 'ingreso', 'ingresar', 'acceder', 'acceso'];
        const cancelKeywords = ['cancelar', 'volver', 'regresar', 'atrás', 'salir', 'cancela'];

        console.log('Analizando comando en texto normalizado:', normalizedText);

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
        if (voiceKeywords.some(keyword => normalizedText.includes(keyword))) {
            console.log('✅ Comando reconocido: login por voz');
            updateAppState('voiceLogin');
            return;
        } 
        if (faceKeywords.some(keyword => normalizedText.includes(keyword))) {
            console.log('✅ Comando reconocido: login facial');
            updateAppState('faceLogin');
            return;
        }
        if ((isRegistering || showVoiceLogin || showFaceLogin) && containsAny(cancelKeywords)) {
            console.log('✅ Comando reconocido: cancelar/volver');
            updateAppState('backToMain');
            return;
        }

        // Si llegamos aquí, no se reconoció ningún comando
        console.log('❌ Comando no reconocido');
        console.log('Comandos disponibles: "iniciar sesión", "registrarse", "voz", "facial", "cancelar"');
        if (sessionStorage.getItem('brailleactivado') === 'false') {
            queueAudioMessage(AUDIO_MESSAGES.notUnderstood);
        }
        // Si estamos en login, delega a processLoginSpeech como fallback
        if (!isRegistering && isLoggingIn) {
            processLoginSpeech(text);
        }
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
        
        // También guardar en window para que FaceRecorder pueda accederlo
        window.recordedAudioBlob = audioBlob;
        
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
                // Introducir un pequeño retraso para asegurar que el DOM esté listo
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
            queueAudioMessage(AUDIO_MESSAGES.voiceRecordingComplete);
            
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
    const handleSubmit = async (e, isBraille = false) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsSubmitting(true);

        const password = sessionStorage.getItem('email');
        sessionStorage.setItem('password', password);
        sessionStorage.setItem('email', email);

        if (isRegistering) {
            if (!username || !email || !password) {
                setError('Por favor completa todos los campos');
                setIsSubmitting(false);
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
                console.log('DEBUG: password al enviar login:', password);
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
        } 
        else if (isBraille) {
            sessionStorage.clear();
            // LOGIN BRAILLE
            try {
                const formData = new FormData();
                formData.append('username', email);
                formData.append('password', password);
        
                console.log('📤 Enviando datos al backend:', {
                    endpoint: `${config.API_URL}/auth/login`,
                    username: email,
                    password
                });
        
                const response = await fetch(`${config.API_URL}/auth/login`, {
                    method: 'POST',
                    body: formData
                });
        
                console.log('📥 Respuesta recibida del servidor:', response);
        
                if (!response.ok) {
                    const errData = await response.json();
                    let errorMsg = 'Error en el inicio de sesión';
        
                    if (typeof errData.detail === 'string') errorMsg = errData.detail;
                    else if (typeof errData.msg === 'string') errorMsg = errData.msg;
                    else if (Array.isArray(errData) && errData.length && typeof errData[0].msg === 'string') errorMsg = errData[0].msg;
                    else errorMsg = JSON.stringify(errData);
        
                    console.error('❌ Error en login:', errorMsg);
                    setError(errorMsg);
                    setIsSubmitting(false);
                    return;
                }
        
                const data = await response.json();
                console.log('✅ Login exitoso. Datos recibidos:', data);
        
                if (!data.access_token) {
                    console.error('❌ No se recibió access_token en la respuesta.');
                    throw new Error('No se recibió token en la respuesta');
                }
                sessionStorage.setItem('access_token', data.access_token);
                login({
                    token: data.access_token,
                    username: data.username || email,
                    email: data.email || email
                });
        
                console.log('➡️ Login ejecutado correctamente. Redirigiendo a /home...');
                navigate('/home');
            } catch (err) {
                console.error('🚨 Error inesperado al iniciar sesión:', err);
                setError('Error al conectar con el servidor');
                setIsSubmitting(false);
            }
            // Termina LOGIN BRAILLE            
        }
        else {
            // LOGIN
            const email = sessionStorage.getItem('email');
            const password = sessionStorage.getItem('password');
            if (!email || !password) {
                console.log('eL ERROR FUE ANTES\n########################################################');
                setError('Por favor completa todos los campos');
                setIsSubmitting(false);
                return;
            }
            
        }
    };

    // Función para iniciar el flujo de login accesible
    const startAccessibleLogin = () => {
        setLoginStep('askEmail');
        setShowVoiceLogin(false);
        setShowFaceLogin(false);
        setShowBrailleInput(false);
        setIsBrailleComplete(false);
        setLoginMethod(null);
        setEmail('');
        setPassword('');
        queueAudioMessage('login');
        setTimeout(() => {
            queueAudioMessage('emailHelp');
        }, 2000);
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
        } catch (err) {
            // Este catch solo captura errores sincrónicos
            console.error("Error en playWithFallback:", err);
        }
    };

    // Función para manejar la contraseña en braille
    const handleBrailleLogin = (email, BraillePasswordLogin) => {
        setPassword(BraillePasswordLogin);
        setShowBrailleInput(false);
        setIsBrailleComplete(true);
        sessionStorage.setItem('email', email);
        sessionStorage.setItem('passwordLogin', BraillePasswordLogin);
        console.log("esto se ejecuta antes\n#################################################################################################################")
        setTimeout(() => {
            handleSubmit({ preventDefault: () => {} }, true); // true indica login braille
        }, 1000); // puedes ajustar este tiempo si necesitas más margen
        
    };

    const handleCancelBrailleLogin = () => {
        setShowBrailleInput(false);
        setLoginStep('chooseMethod');
    };

    // Función para manejar la contraseña en braille durante el registro
    const handleBraillePasswordComplete = (braillePassword) => {
        setPassword(braillePassword);
        setShowBrailleInput(false);
        setIsBrailleComplete(true);
        sessionStorage.setItem('password', braillePassword);
        sessionStorage.setItem('email', email);
        sessionStorage.setItem('username', username);
        setShowVoiceRecorder(true); // Nuevo estado para mostrar el grabador de voz
        // Puedes agregar lógica adicional aquí, como avanzar al siguiente paso del registro
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
    }, [showBrailleInput]);

    useEffect(() => {
        console.log('DEBUG password state:', password);
    }, [password]);

    const [wasRegistered, setWasRegistered] = useState(false);

    useEffect(() => {
      const registeredFlag = sessionStorage.getItem('registered');
      if (registeredFlag === 'true') {
        setWasRegistered(true);
        sessionStorage.removeItem('registered'); // Limpiar para que no se muestre otra vez
      }
    }, []);

    // Función para procesar lo que dice el usuario durante login
    const processLoginSpeech = (text) => {
        const normalizedText = text.trim().toLowerCase();
        if (loginStep === 'askEmail') {
            // Intentar reconocer correo
            handleEmailRecognition(normalizedText);
            // Si se reconoce, pasar al siguiente paso
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedText) || email) {
                setLoginStep('chooseMethod');
                setTimeout(() => {
                    queueAudioMessage('askLoginOrRegister');
                }, 1000);
            }
            return;
        }
        if (loginStep === 'chooseMethod') {
            if (voiceKeywords.some(keyword => normalizedText.includes(keyword))) {
                setLoginMethod('voice');
                setShowVoiceLogin(true);
                setShowFaceLogin(false);
                setShowBrailleInput(false);
                queueAudioMessage('voiceLogin');
            } else if (faceKeywords.some(keyword => normalizedText.includes(keyword))) {
                setLoginMethod('face');
                setShowVoiceLogin(false);
                setShowFaceLogin(true);
                setShowBrailleInput(false);
                queueAudioMessage('faceLogin');
            } else if (brailleKeywords.some(keyword => normalizedText.includes(keyword))) {
                setLoginMethod('braille');
                setShowVoiceLogin(false);
                setShowFaceLogin(false);
                setShowBrailleInput(true);
                queueAudioMessage('passwordPrompt');
            } else {
                queueAudioMessage('notUnderstood');
            }
            return;
        }
    };

    // Cleanup global variables when component unmounts
    useEffect(() => {
        return () => {
            // Cleanup window objects when component unmounts
            if (window.recordedAudioBlob) {
                console.log("🧹 Limpiando audio blob global al desmontar AccessibleLogin");
                window.recordedAudioBlob = null;
            }
        };
    }, []);

    useEffect(() => {
        if (wasRegistered) {
          const timer = setTimeout(() => {
            setWasRegistered(false); // o el nombre que uses para actualizarlo
          }, 5000); // 5000 milisegundos = 5 segundos
      
          return () => clearTimeout(timer); // limpia el timeout si cambia antes
        }
      }, [wasRegistered]);
      

    return (
        <div
          className="relative min-h-screen flex items-center justify-center bg-gray-900 text-gray-100 font-sans overflow-hidden"
          onClick={handleUserInteraction}
          onTouchStart={handleUserInteraction}
          tabIndex={0}
          role="button"
          aria-label="Activar asistente vocal"
        >
          {/* Círculos animados de neón con adiciones */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Anillo principal original */}
            <div className="neon-ring"></div>
            
            {/* Nuevo anillo exterior girando en sentido contrario */}
            <div className="neon-ring-outer"></div>
            
            {/* Nuevo anillo interior */}
            <div className="neon-ring-inner"></div>
            
            {/* Partículas doradas flotantes */}
            <div className="golden-particles">
              <div className="golden-particle"></div>
              <div className="golden-particle"></div>
              <div className="golden-particle"></div>
              <div className="golden-particle"></div>
              <div className="golden-particle"></div>
              <div className="golden-particle"></div>
            </div>
            
            {/* Destellos dorados en las esquinas */}
            <div className="golden-corner"></div>
            <div className="golden-corner"></div>
            <div className="golden-corner"></div>
            <div className="golden-corner"></div>
          </div>
      
          <div className="relative z-10 max-w-md w-full p-8 bg-gray-800/80 backdrop-blur-xl rounded-xl border border-pink-500/20 golden-border shadow-2xl glow-card">
            {wasRegistered && (
              <div className="bg-green-900/30 border border-green-500/30 text-green-400 px-4 py-3 rounded mb-4 text-center neon-text-green">
                ✅ Registro exitoso. Ahora puedes iniciar sesión.
              </div>
            )}
      
            <h2 className="text-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-yellow-400 to-green-500 mb-6">
              {isRegistering
                ? 'Crear cuenta accesible'
                : isLoggingIn
                ? 'Iniciar sesión accesible'
                : 'Acceso accesible por voz'}
            </h2>
      
            <p className="text-center text-sm golden-text mb-6">
              Sistema de acceso para personas con discapacidad visual
            </p>
      
            {!isInitialized && (
              <p className="mt-4 text-center text-lg text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-yellow-400 animate-pulse">
                Toca cualquier parte de la pantalla para comenzar
              </p>
            )}
      
            {isInitialized && !isListening && (
              <div className="mt-4 text-center space-y-2 neon-instructions">
                <p className="text-sm">
                  Presiona la tecla <span className="font-semibold text-pink-400">espacio</span> para activar el asistente
                </p>
                <p className="text-sm">
                  Presiona <span className="font-semibold text-yellow-400">enter</span> para repetir el último mensaje
                </p>
                <p className="text-sm">
                  Presiona <span className="font-semibold text-green-400">espacio</span> durante un audio para interrumpirlo
                </p>
              </div>
            )}
      
            {isLoggingIn && !showVoiceLogin && !showFaceLogin && !showBrailleInput && !email && (
              <div className="input-wrapper mt-6">
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-transparent border-b-2 border-pink-500/50 focus:border-pink-500 text-gray-100 placeholder-gray-500 focus:outline-none sm:text-sm input-glow"
                  placeholder="Correo electrónico"
                  autoFocus
                />
              </div>
            )}
      
            {!showVoiceLogin && !showFaceLogin ? (
              isRegistering && showBrailleInput ? (
                <div className="mt-8 braille-container">
                  <h3 className="text-lg font-medium text-center text-blue-800 mb-4">
                    Creación de contraseña mediante Braille
                  </h3>
                  <p className="text-sm text-center text-gray-600 mb-4">
                    Indica verbalmente los puntos del patrón braille para crear tu contraseña
                  </p>
                  <BraillePassword onPasswordComplete={handleBraillePasswordComplete} />
                </div>
              ) : !isRegistering && showBrailleInput ? (
                <div className="mt-8 braille-container">
                  <h3 className="text-lg font-medium text-center text-blue-800 mb-4">
                    Creación de contraseña mediante Braille
                  </h3>
                  <p className="text-sm text-center text-gray-600 mb-4">
                    Indica verbalmente los puntos del patrón braille para crear tu contraseña
                  </p>
                  <BraillePasswordLogin email={email} onPasswordComplete={handleBrailleLogin} onCancel={handleCancelBrailleLogin} />
                </div>
              ) : (
                isRegistering || (isLoggingIn && email) ? (
                  <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {/* ...inputs y mensajes de error/success como ya tienes... */}
                    <div className="input-wrapper">
                      {isRegistering && !isBrailleComplete && (
                        <input
                          id="username"
                          name="username"
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-4 py-3 bg-transparent border-b-2 border-yellow-500/50 focus:border-yellow-500 text-gray-100 placeholder-gray-500 focus:outline-none sm:text-sm input-glow"
                          placeholder="Nombre de usuario"
                        />
                      )}
                      {(isRegistering || (isLoggingIn && email)) && (
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoggingIn}
                          className="w-full px-4 py-3 bg-transparent border-b-2 border-pink-500/50 focus:border-pink-500 text-gray-100 placeholder-gray-500 focus:outline-none sm:text-sm input-glow"
                          placeholder="Correo electrónico"
                        />
                      )}
                      <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border-b-2 border-green-500/50 focus:border-green-500 text-gray-100 placeholder-gray-500 focus:outline-none sm:text-sm input-glow"
                        placeholder="Contraseña"
                      />
                    </div>
                    {/* Mensajes de transcript, error, success, audioError, isListening... */}
                    {transcript && (
                      <div className="mt-4 p-4 bg-gray-800/70 rounded-md border border-pink-500/30">
                        <p className="text-sm text-gray-300">Texto reconocido: {transcript}</p>
                      </div>
                    )}
                    {error && <div className="text-pink-500 text-sm text-center">{error}</div>}
                    {success && <div className="text-green-500 text-sm text-center">{success}</div>}
                    {audioError && (
                      <div className="mt-4 p-4 bg-red-900/30 rounded-md border border-red-500/30">
                        <p className="text-sm text-red-400">
                          Error al reproducir audio. Verifica que los archivos existan.
                        </p>
                      </div>
                    )}
                    {isListening && (
                      <div className="mt-4 p-4 bg-green-900/30 rounded-md border border-green-500/30">
                        <p className="text-sm text-green-400">Escuchando... (1s de silencio)</p>
                      </div>
                    )}
                    <button
                      type="submit"
                      className="w-full py-3 px-4 border border-transparent rounded-full text-sm font-medium text-gray-900 bg-gradient-to-r from-pink-500 via-yellow-400 to-green-500 hover:from-pink-600 hover:via-yellow-500 hover:to-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-pink-500 transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg shadow-neon-glow"
                    >
                      {isRegistering ? 'Registrarse' : 'Iniciar sesión'}
                    </button>
                    <div className="flex justify-between text-sm pt-2">
                      <button type="button" className="text-pink-400 hover:text-pink-300 transition-colors">
                        Olvidé mi contraseña
                      </button>
                      <button type="button" className="text-green-400 hover:text-green-300 transition-colors">
                        Registrarse
                      </button>
                    </div>
                  </form>
                ) : null
              )
            ) : showFaceLogin ? (
              <div className="mt-8 bg-gray-800/70 p-6 rounded-lg border border-cyan-500/30">
                <FaceLogin onLoginSuccess={handleVoiceLoginSuccess} />
                <div className="mt-4 text-center">
                  <button
                    onClick={() => updateAppState('backToMain')}
                    className="text-sm text-cyan-500 hover:text-cyan-400 transition-colors"
                  >
                    Volver al login normal
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 bg-gray-800/70 p-6 rounded-lg border border-pink-500/30">
                <h3 className="text-lg font-semibold mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500">
                  Reconocimiento de voz
                </h3>
                <VoiceLoginRecorder
                  autoStart={true}
                  login={login}
                  navigate={navigate}
                  onRecordingComplete={setAudioBlob}
                  onStartRecording={() => setIsRecording(true)}
                  onStopRecording={() => setIsRecording(false)}
                />
                <div className="mt-4 text-center">
                  <button
                    onClick={() => updateAppState('backToMain')}
                    className="text-sm text-pink-500 hover:text-pink-400 transition-colors"
                  >
                    Volver al login normal
                  </button>
                </div>
              </div>
            )}

            {/* Registro biométrico opcional */}
            {isRegistering && isBrailleComplete && (
              <div className="mt-8">
                <div className="mb-6 p-6 bg-gray-800/70 rounded-lg border border-green-500/30 glow-card-green">
                  <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400 mb-3">
                    Registro Biométrico (Opcional)
                  </h3>
                  <p className="text-sm text-green-400 mb-2">
                    Has registrado correctamente tu contraseña mediante braille.
                  </p>
                  <p className="text-sm text-cyan-400">
                    Ahora puedes registrar tu voz y tu rostro para facilitar tus inicios de sesión futuros.
                  </p>
                </div>
      
                <div className="bg-gray-800/70 p-6 rounded-lg border border-pink-500/30 mb-6">
                  <div className="text-center mb-4">
                    <p className="text-sm text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 font-medium">
                      Grabación de voz (opcional)
                    </p>
                    <p className="text-xs text-gray-500">Te permitirá iniciar sesión usando tu voz en el futuro</p>
                  </div>
      
                  {showVoiceRecorder && (
                    <VoiceRecorder
                      onRecordingComplete={handleVoiceRecordingComplete}
                      onStartRecording={handleStartRecording}
                      onStopRecording={handleStopRecording}
                      autoStart={true}
                    />
                  )}
                </div>
      
                <div className="bg-gray-800/70 p-6 rounded-lg border border-cyan-500/30 mb-6">
                  <div className="text-center mb-4">
                    <p className="text-sm text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-medium">
                      Registro facial (opcional)
                    </p>
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
                    className="w-full py-3 px-4 border border-transparent rounded-full text-sm font-medium text-gray-900 bg-gradient-to-r from-green-400 to-cyan-400 hover:from-green-500 hover:to-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500 transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-lg shadow-neon-glow-green"
                  >
                    Completar Registro
                  </button>
                </div>
              </div>
            )}
      
            {/* Debug de estado */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-6 p-4 bg-gray-950 text-gray-300 text-xs rounded shadow-lg opacity-80">
                <h4 className="font-bold mb-2 text-pink-400">Estado actual:</h4>
                <ul className="space-y-1">
                  <li>isRegistering: {isRegistering ? '✅' : '❌'}</li>
                  <li>showVoiceLogin: {showVoiceLogin ? '✅' : '❌'}</li>
                  <li>showFaceLogin: {showFaceLogin ? '✅' : '❌'}</li>
                  <li>isLoggingIn: {isLoggingIn ? '✅' : '❌'}</li>
                  <li>isListening: {isListening ? '✅' : '❌'}</li>
                  <li>isInitialized: {isInitialized ? '✅' : '❌'}</li>
                </ul>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => updateAppState('register')} className="bg-pink-600 px-2 py-1 rounded text-xs">
                    Forzar Registro
                  </button>
                  <button onClick={() => updateAppState('login')} className="bg-cyan-600 px-2 py-1 rounded text-xs">
                    Forzar Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

export default AccessibleLogin;