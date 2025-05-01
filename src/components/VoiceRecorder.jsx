import React, { useState, useEffect, useRef } from 'react';
import './VoiceRecorder.css';
import { config } from '../config';
import { playPredefinedMessage, playBeep } from '../services/audioService';

const VoiceRecorder = ({ onRecordingComplete, onStartRecording, onStopRecording, registrationStepProp, autoStart }) => {
    // Estados existentes
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSuccess, setRecordingSuccess] = useState(false);
    const [error, setError] = useState('');
    const [audioChunks, setAudioChunks] = useState([]);
    const [volume, setVolume] = useState(0); // Para mostrar el nivel de volumen
    const [debugInfo, setDebugInfo] = useState(''); // Para mostrar información de depuración
    const [silenceDetected, setSilenceDetected] = useState(false); // Estado para mostrar si se ha detectado silencio
    const [allLevels, setAllLevels] = useState([]); // Para guardar todos los niveles de audio
    const [microphoneState, setMicrophoneState] = useState(''); // Estado del micrófono
    const [detectorState, setDetectorState] = useState(''); // Estado del detector
    const [audioSummary, setAudioSummary] = useState(null); // Estado para mostrar resumen de datos
    
    // NUEVO: Estado para evitar iniciar múltiples grabaciones
    const [recordingProcessed, setRecordingProcessed] = useState(false);
    
    // Referencias existentes
    const recordButtonRef = useRef(null);
    const isStoppingRef = useRef(false);
    const isRecordingRef = useRef(false); // Añadido para resolver el error de referencia
    const silenceTimeoutRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const hasProcessedAudioRef = useRef(false);
    const hasVoiceBeenDetectedRef = useRef(false);
    const recordingTimerRef = useRef(null);
    const hasPlayedBeepRef = useRef(false);
    const volumeAverageRef = useRef(0);
    const consecutiveFramesCounterRef = useRef(0);
    const audioLevelsBufferRef = useRef([]);
    const animationFrameRef = useRef(null);
    const processorRef = useRef(null);
    const sourceRef = useRef(null);
    const hasLoggedAudioRef = useRef(false);
    const frameCounterRef = useRef(0);
    const lastLevelCheckRef = useRef(Date.now());
    const testToneRef = useRef(null);
    const lastAveragesRef = useRef([]);
    const rawLevelsRef = useRef([]);
    const intervalIdRef = useRef(null);
    const mediaRecorderRef = useRef(null);

    const PHRASE = "Yo soy " + (window.registeredUsername || "tu nombre completo");
    
    // Configuración de umbral de silencio ajustada (valores más bajos = más sensible al silencio)
    const SILENCE_THRESHOLD = 40; // Aumentado para mejor detección de silencio
    const VOICE_THRESHOLD = 50; // Mantenido igual para detección de voz
    const FRAMES_TO_CONSIDER_SILENCE = 5; // Reducido para más rápida detección de silencio
    const FRAMES_TO_START_RECORDING = 2; 
    const SILENCE_TIMEOUT_MS = 800; // Reducido para finalizar más rápido tras silencio
    const BUFFER_SIZE = 30; 
    const VOICE_DEBOUNCE_TIME = 500;

    // Nivel de depuración
    const DEBUG_LEVEL = 3; // Aumentado a 3 para mostrar logs más detallados

    // Función mejorada para registrar mensajes de depuración
    const debugLog = (message, level = 1) => {
        if (DEBUG_LEVEL >= level) {
            const timestamp = new Date().toLocaleTimeString('es-ES', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3
            });
            
            const formattedMessage = `[${timestamp}] ${message}`;
            console.log(formattedMessage);
            
            // Para depuración en UI, solo mensajes importantes (nivel 1, 2 y 3)
            if (level <= 3) {
                setDebugInfo(prev => `${formattedMessage}\n${prev}`.substring(0, 2000));
            }
        }
    };

    // Limpiar recursos al desmontar el componente
    useEffect(() => {
        debugLog('🔄 Componente VoiceRecorder montado', 1);
        
        // Verificar si el navegador soporta AudioContext y MediaRecorder
        const checkAudioAPIs = () => {
            if (!window.AudioContext && !window.webkitAudioContext) {
                debugLog('❌ AudioContext no está soportado en este navegador', 1);
            } else {
                debugLog('✅ AudioContext está soportado', 1);
            }
            
            if (!window.MediaRecorder) {
                debugLog('❌ MediaRecorder no está soportado en este navegador', 1);
            } else {
                debugLog('✅ MediaRecorder está soportado', 1);
            }
        };
        
        checkAudioAPIs();
        
        return () => {
            debugLog('🔄 Componente VoiceRecorder desmontado, limpiando recursos...', 1);
            safeStopRecording('Componente desmontado');
        };
    }, []);
    
    // Log cuando cambia el estado de isRecording
    useEffect(() => {
        debugLog(`🎙️ Estado de grabación: ${isRecording ? 'ACTIVO' : 'INACTIVO'}`, 1);
        // Actualizar la ref para que esté sincronizada con el estado
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    // Efecto para limpiar el intervalo cuando se desmonte o cambie el estado de grabación
    useEffect(() => {
        return () => {
            if (intervalIdRef.current) {
                debugLog('🧹 Limpiando intervalo de monitoreo desde efecto', 2);
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        };
    }, [isRecording]);

    // Función para generar un tono de prueba para verificar que el audio funciona
    const generateTestTone = () => {
        try {
            if (!audioContextRef.current) {
                debugLog('⚠️ No hay contexto de audio para generar tono de prueba', 1);
                return;
            }
            
            debugLog('🔊 Generando tono de prueba para verificar audio...', 1);
            
            // Crear un oscilador
            const oscillator = audioContextRef.current.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioContextRef.current.currentTime); // 440 Hz = nota La
            
            // Crear un nodo de ganancia para controlar el volumen
            const gainNode = audioContextRef.current.createGain();
            gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime); // Volumen bajo
            
            // Conectar el oscilador al nodo de ganancia y luego a la salida
            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            
            // Guardar referencia para poder detenerlo
            testToneRef.current = oscillator;
            
            // Iniciar el oscilador
            oscillator.start();
            
            // Detener después de 500ms
            setTimeout(() => {
                if (testToneRef.current) {
                    testToneRef.current.stop();
                    testToneRef.current = null;
                    debugLog('🔊 Tono de prueba finalizado', 1);
                }
            }, 500);
            
        } catch (error) {
            console.error('Error al generar tono de prueba:', error);
            debugLog(`❌ Error al generar tono de prueba: ${error.message}`, 1);
        }
    };

    // Función segura para detener la grabación evitando múltiples llamadas
    const safeStopRecording = (reason = "Manual") => {
        if (isStoppingRef.current) {
            debugLog("⛔ Ya estamos deteniendo", 1);
            return;
        }
      
        isStoppingRef.current = true;
        isRecordingRef.current = false;
        setIsRecording(false);
      
        debugLog(`🛑 DETENIENDO GRABACIÓN POR: ${reason}`, 1);
      
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
        }
      
        if (recordingTimerRef.current) {
            clearTimeout(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
      
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }
      
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
      
        // Detener tono de prueba si existe
        if (testToneRef.current) {
            try {
                testToneRef.current.stop();
                testToneRef.current = null;
            } catch (error) {
                console.error('Error al detener tono de prueba:', error);
            }
        }
      
        // Detener mediaRecorder
        if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
            try {
                debugLog(`📼 MediaRecorder activo detectado (estado: ${mediaRecorder.state}), deteniendo...`, 1);
                mediaRecorder.stop();
                
                // Notificar al componente padre
                if (onStopRecording) {
                    onStopRecording();
                }
                
                debugLog('✅ Grabación detenida correctamente', 1);
            } catch (error) {
                console.error('❌ Error al detener MediaRecorder:', error);
                debugLog(`❌ ERROR AL DETENER GRABACIÓN: ${error.message}`, 1);
            }
        }
      
        // Detener stream
        if (streamRef.current) {
            try {
                const tracks = streamRef.current.getTracks();
                debugLog(`🧹 Deteniendo ${tracks.length} tracks de audio`, 2);
                tracks.forEach(track => {
                    debugLog(`🧹 Deteniendo track: ${track.kind} - ${track.label} - ${track.readyState}`, 2);
                    track.stop();
                });
            } catch (err) {
                console.error("Error al detener tracks de stream:", err);
                debugLog(`❌ Error al detener tracks: ${err.message}`, 1);
            }
            streamRef.current = null;
        }
      
        // Desconectar processor y source
        if (processorRef.current) {
            try {
                processorRef.current.disconnect();
                processorRef.current = null;
            } catch (err) {
                console.error("Error al desconectar processor:", err);
            }
        }
      
        if (sourceRef.current) {
            try {
                sourceRef.current.disconnect();
                sourceRef.current = null;
            } catch (err) {
                console.error("Error al desconectar source:", err);
            }
        }
      
        if (analyserRef.current) {
            try {
                analyserRef.current = null;
            } catch (err) {
                console.error("Error al limpiar analyser:", err);
            }
        }
      
        // Cerrar contexto de audio
        if (audioContextRef.current) {
            try {
                audioContextRef.current.close().then(() => {
                    debugLog('✅ Contexto de audio cerrado correctamente', 2);
                }).catch(err => {
                    console.error("Error al cerrar contexto de audio:", err);
                    debugLog(`❌ Error al cerrar contexto de audio: ${err.message}`, 1);
                });
            } catch (err) {
                console.error("Error al intentar cerrar contexto de audio:", err);
                debugLog(`❌ Error al cerrar contexto de audio: ${err.message}`, 1);
            }
            audioContextRef.current = null;
        }
      
        // Restablecer referencias
        hasVoiceBeenDetectedRef.current = false;
        hasPlayedBeepRef.current = false;
        volumeAverageRef.current = 0;
        consecutiveFramesCounterRef.current = 0;
        audioLevelsBufferRef.current = [];
        hasLoggedAudioRef.current = false;
        frameCounterRef.current = 0;
        lastLevelCheckRef.current = Date.now();
        lastAveragesRef.current = [];
        rawLevelsRef.current = [];
        
        // Limpiar arreglo de niveles
        setAllLevels([]);
        setMicrophoneState('');
        setDetectorState('');
      
        debugLog("🎙️ Todos los recursos de audio liberados", 1);
      
        setTimeout(() => {
            isStoppingRef.current = false;
            debugLog("🔄 Listo para una nueva grabación", 2);
        }, 200);
    };

    // Función para calcular si hay silencio basado en el buffer de audio
    const calculateSilenceFromBuffer = () => {
        if (audioLevelsBufferRef.current.length < 5) {
            debugLog('⚠️ Buffer de audio insuficiente para calcular silencio', 2);
            return false;
        }
        
        // Obtener los últimos niveles
        const recentLevels = audioLevelsBufferRef.current.slice(-5);
        
        // Calcular el promedio de los últimos niveles
        const average = recentLevels.reduce((acc, val) => acc + val, 0) / recentLevels.length;
        
        // Considerar silencio si el promedio está por debajo del umbral
        const isSilent = average < SILENCE_THRESHOLD;
        debugLog(`🔍 Análisis de buffer: Promedio=${average.toFixed(2)}, Umbral=${SILENCE_THRESHOLD}, Silencio=${isSilent ? 'SÍ' : 'NO'}`, 2);
        
        return isSilent;
    };

    const handleStartRecording = async (e) => {
        // Si se llamó programáticamente, e podría ser undefined
        if (e) e.preventDefault();
        
        // No iniciar si ya estamos grabando o en proceso de detener
        if (isRecording || isStoppingRef.current) {
            debugLog('Ya estamos grabando o en proceso de detener, ignorando solicitud', 1);
            return;
        }
        
        debugLog('▶️ INICIANDO GRABACIÓN...', 1);
        debugLog(`📝 Navegador: ${navigator.userAgent}`, 1);
        
        // Verificar soporte de AudioContext y MediaRecorder al iniciar
        if (!window.AudioContext && !window.webkitAudioContext) {
            debugLog('❌ ERROR: AudioContext no está soportado en este navegador', 1);
            setError('Tu navegador no soporta AudioContext, necesario para la detección de silencio.');
            return;
        }
        
        if (!window.MediaRecorder) {
            debugLog('❌ ERROR: MediaRecorder no está soportado en este navegador', 1);
            setError('Tu navegador no soporta la grabación de audio.');
            return;
        }
        
        // Limpiar estados
        setError('');
        setRecordingSuccess(false);
        setAudioChunks([]);
        setDebugInfo('');
        setSilenceDetected(false);
        setAllLevels([]);
        setMicrophoneState('Inicializando...');
        setDetectorState('Preparando...');
        
        // Limpiar referencias
        hasProcessedAudioRef.current = false;
        hasVoiceBeenDetectedRef.current = false;
        hasPlayedBeepRef.current = false;
        volumeAverageRef.current = 0;
        consecutiveFramesCounterRef.current = 0;
        audioLevelsBufferRef.current = [];
        hasLoggedAudioRef.current = false;
        frameCounterRef.current = 0;
        lastLevelCheckRef.current = Date.now();
        lastAveragesRef.current = [];
        rawLevelsRef.current = [];
        
        try {
            debugLog('🎤 Solicitando acceso al micrófono...', 1);
            setMicrophoneState('Solicitando acceso...');
            
            // Listar dispositivos disponibles
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                debugLog(`📱 Dispositivos de audio disponibles: ${audioInputs.length}`, 1);
                
                audioInputs.forEach((device, index) => {
                    debugLog(`📱 Micrófono ${index + 1}: ${device.label || 'Sin nombre'} (${device.deviceId.substring(0, 8)}...)`, 1);
                });
            } catch (err) {
                debugLog(`⚠️ No se pudieron enumerar dispositivos: ${err.message}`, 1);
            }
            
            // Solicitar acceso al micrófono con opciones avanzadas
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 44100
                } 
            });
            
            debugLog('✅ Acceso al micrófono concedido', 1);
            setMicrophoneState('Acceso concedido');
            
            // Mostrar información sobre el stream de audio
            const audioTracks = stream.getAudioTracks();
            debugLog(`🎤 Tracks de audio: ${audioTracks.length}`, 1);
            
            if (audioTracks.length > 0) {
                const track = audioTracks[0];
                debugLog(`🎤 Track principal: ${track.label} - Estado: ${track.readyState}`, 1);
                
                try {
                    const settings = track.getSettings();
                    debugLog(`🎤 Configuración: Canal=${settings.channelCount || 'N/A'}, Frecuencia=${settings.sampleRate || 'N/A'}Hz`, 1);
                } catch (err) {
                    debugLog(`⚠️ No se pudieron obtener ajustes del track: ${err.message}`, 1);
                }
            }
            
            // Guardar referencia al stream para limpieza posterior
            streamRef.current = stream;
            
            // Crear MediaRecorder con la configuración más compatible
            debugLog('📼 Creando MediaRecorder...', 1);
            
            // Verificar los tipos MIME soportados
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4'
            ];
            
            let selectedMimeType = '';
            
            for (const type of mimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    selectedMimeType = type;
                    debugLog(`📼 Tipo MIME soportado: ${type}`, 1);
                    break;
                }
            }
            
            if (!selectedMimeType) {
                debugLog('⚠️ Ningún tipo MIME soportado, usando el predeterminado', 1);
                selectedMimeType = 'audio/webm;codecs=opus';
            }
            
            const recorder = new MediaRecorder(stream, {
                mimeType: selectedMimeType,
                audioBitsPerSecond: 128000
            });
            
            debugLog(`📼 MediaRecorder creado con formato: ${recorder.mimeType}`, 1);
            
            const chunks = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    debugLog(`📊 Datos de audio disponibles: ${(e.data.size / 1024).toFixed(2)} KB`, 2);
                    chunks.push(e.data);
                    setAudioChunks(chunks);
                } else {
                    debugLog('⚠️ Evento ondataavailable sin datos', 2);
                }
            };

            recorder.onstop = () => {
                // Verificar si ya hemos procesado este audio para evitar procesamiento duplicado
                if (hasProcessedAudioRef.current) {
                    debugLog('⚠️ Audio ya procesado, ignorando evento onstop duplicado', 1);
                    return;
                }
                
                // Marcar como procesado para evitar duplicados
                hasProcessedAudioRef.current = true;
                
                debugLog('🔄 Procesando audio grabado...', 1);
                
                // Verificar si tenemos chunks
                if (chunks.length === 0) {
                    debugLog('❌ ERROR: No hay chunks de audio grabados', 1);
                    setError('No se pudo grabar audio. Por favor, verifica que tu micrófono esté funcionando correctamente.');
                    isStoppingRef.current = false;
                    return;
                }
                
                // Crear un nombre de archivo temporal único
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const randomSuffix = Math.floor(Math.random() * 10000);
                const tempFilename = `voice_recording_${timestamp}_${randomSuffix}.wav`;
                
                // Crear blob con los chunks
                const blob = new Blob(chunks, { type: 'audio/wav' });
                window.recordedAudioBlob = blob;
                const blobSizeKB = (blob.size / 1024).toFixed(2);
                debugLog(`💾 Blob de audio creado: ${blobSizeKB} KB`, 1);
                
                // Crear una URL para el blob
                const audioUrl = URL.createObjectURL(blob);
                const recordingMetadata = {
                    url: audioUrl,
                    sizeKB: blobSizeKB,
                    format: recorder.mimeType,
                    filename: tempFilename,
                };
                sessionStorage.setItem('recordedAudio', JSON.stringify(recordingMetadata));
                

                const raw = sessionStorage.getItem('recordedAudio');

                if (raw) {
                    const data = JSON.parse(raw);

                    console.log('\n%c========== DATOS DE AUDIO GRABADO ==========', 'color: #9C27B0; font-weight: bold; font-size: 14px;');
                    console.log('%cURL temporal: %c' + data.url, 'color: #3F51B5; font-weight: bold;', 'color: black;');
                    console.log('%cTamaño: %c' + data.sizeKB + ' KB', 'color: #3F51B5; font-weight: bold;', 'color: black;');
                    console.log('%cDuración: %c' + data.duration + ' segundos', 'color: #3F51B5; font-weight: bold;', 'color: black;');
                    console.log('%cFormato: %c' + data.format, 'color: #3F51B5; font-weight: bold;', 'color: black;');
                    console.log('%cNombre temporal: %c' + data.filename, 'color: #3F51B5; font-weight: bold;', 'color: black;');
                    console.log('%c=============================================', 'color: #9C27B0; font-weight: bold; font-size: 14px;');
                }

                // Pasar el blob al callback y marcar como exitoso
                onRecordingComplete(blob);
                setRecordingSuccess(true);
                
                // Obtener duración del audio (aproximada)
                const audioElement = new Audio(audioUrl);
                audioElement.addEventListener('loadedmetadata', () => {
                    const durationSecs = audioElement.duration.toFixed(2);
                                       
                    // Imprimir resumen de datos del audio guardado
                    debugLog(`✅ AUDIO GUARDADO EXITOSAMENTE`, 1);
                    debugLog(`📊 RESUMEN DEL AUDIO:`, 1);
                    debugLog(`   - Tamaño: ${blobSizeKB} KB`, 1);
                    debugLog(`   - Duración: ${durationSecs} segundos`, 1);
                    debugLog(`   - Formato: ${recorder.mimeType}`, 1);
                    debugLog(`   - Nombre temporal: ${tempFilename}`, 1);
                    
                    // Imprimir en la consola los datos de usuario y audio
                    const username = sessionStorage.getItem('username');
                    const email = sessionStorage.getItem('email');
                    const password = sessionStorage.getItem('password');

                    console.log(username, email, password);

                    console.log('===== DATOS DE USUARIO Y GRABACIÓN =====');
                    console.log('Nombre de usuario:', username);
                    console.log('Email:', email);
                    console.log('Contraseña:', password);
                    console.log('Datos de audio:');
                    console.log('- Tamaño:', blobSizeKB, 'KB');
                    console.log('- Duración:', durationSecs, 'segundos');
                    console.log('- Formato:', recorder.mimeType);
                    console.log('- Archivo temporal:', tempFilename);
                    console.log('==========================================');
                    
                    // En lugar de guardar en el estado para la interfaz, imprimir en consola
                    const recordingData = {
                        audioSize: blobSizeKB,
                        audioDuration: durationSecs,
                        audioFormat: recorder.mimeType,
                        tempFilename
                    };
                    
                    // Imprimir en la consola los datos de localStorage (solo los relacionados con la grabación)
                    console.log('===== DATOS DE GRABACIÓN EN LOCALSTORAGE =====');
                    console.log('Datos de audio:');
                    console.log('- Tamaño:', blobSizeKB, 'KB');
                    console.log('- Duración:', durationSecs, 'segundos');
                    console.log('- Formato:', recorder.mimeType);
                    console.log('- Archivo temporal:', tempFilename);
                    console.log('==========================================');
                    
                    // No mostramos la interfaz bonita, solo actualizamos el estado para que la app siga funcionando
                    setAudioSummary(null);
                    
                    // Programar reproducción del audio después de 2 segundos
                    setTimeout(() => {
                        debugLog('🔊 REPRODUCIENDO AUDIO GRABADO...', 1);
                        const playbackAudio = new Audio(audioUrl);
                        
                        playbackAudio.onplay = () => {
                            debugLog('▶️ Reproducción del audio grabado iniciada', 1);
                        };
                        
                        playbackAudio.onended = () => {
                            debugLog('⏹️ Reproducción del audio grabado finalizada', 1);
                            URL.revokeObjectURL(audioUrl);
                        
                            // Ejecutar código async dentro de una IIFE
                            (async () => {
                                await playPredefinedMessage("faceCapture");
                                document.getElementById("iniciarCamaraBtn")?.click();
                            })();
                        };
                        
                        playbackAudio.onerror = (error) => {
                            debugLog(`❌ Error al reproducir el audio grabado: ${error}`, 1);
                            URL.revokeObjectURL(audioUrl);
                        };
                        
                        // Iniciar reproducción
                        playbackAudio.play().catch(error => {
                            debugLog(`❌ Error al iniciar la reproducción: ${error}`, 1);
                        });
                    }, 2000); // 2 segundos de espera
                });
                
                // Usar el servicio de audio mejorado para evitar duplicaciones
                try {
                    playPredefinedMessage('voiceRecordingComplete');
                } catch (error) {
                    console.error('Error al reproducir mensaje de grabación completa:', error);
                    debugLog(`❌ Error al reproducir mensaje de grabación completa: ${error.message}`, 1);
                }
                
                // Después de un tiempo, permitir nuevas grabaciones
                setTimeout(() => {
                    debugLog('🔄 Listo para una nueva grabación', 2);
                    isStoppingRef.current = false;
                }, 1500);
            };

            recorder.onerror = (event) => {
                debugLog(`❌ ERROR en MediaRecorder: ${event.error}`, 1);
                setError(`Error en la grabación: ${event.error || 'Error desconocido'}`);
            };

            // Establecer el mediaRecorder antes de iniciar
            setMediaRecorder(recorder);
            mediaRecorderRef.current = recorder;
            
            // Reproducir el mensaje de grabación (una sola vez gracias al servicio mejorado)
            debugLog('🔊 Reproduciendo mensaje de instrucción...', 1);
            await playPredefinedMessage('voiceRecordingPrompt');
            
            // Iniciar la grabación
            debugLog('📼 Iniciando MediaRecorder...', 1);
            recorder.start(500); // Solicitar datos cada 500ms para mayor frecuencia
            setIsRecording(true);
            
            // Esperar un momento y reproducir el beep para indicar que puede comenzar a hablar
            setTimeout(async () => {
                if (!hasPlayedBeepRef.current && !isStoppingRef.current) {
                    hasPlayedBeepRef.current = true;
                    try {
                        debugLog('🔊 Reproduciendo beep...', 1);
                        await playBeep();
                        debugLog('🔊 Beep reproducido, el usuario puede comenzar a hablar', 1);
                    } catch (error) {
                        console.error('Error al reproducir beep:', error);
                        debugLog(`❌ Error al reproducir beep: ${error.message}`, 1);
                    }
                }
            }, 500);
            
            // Notificar al componente padre
            if (onStartRecording) {
                onStartRecording();
            }
            
            debugLog('🎙️ Grabación iniciada correctamente', 1);
            
            // Configurar detector de silencio mejorado
            configureSimpleDetector(stream);
            
        } catch (err) {
            console.error('Error al acceder al micrófono:', err);
            debugLog(`❌ ERROR AL ACCEDER AL MICRÓFONO: ${err.message}`, 1);
            
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Permiso para usar el micrófono denegado. Por favor, acepta el permiso y vuelve a intentarlo.');
                setMicrophoneState('Permiso denegado');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError('No se encontró ningún micrófono. Por favor, conecta un micrófono y vuelve a intentarlo.');
                setMicrophoneState('No encontrado');
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                setError('El micrófono está en uso por otra aplicación. Cierra otras aplicaciones que puedan estar usando el micrófono.');
                setMicrophoneState('En uso por otra app');
            } else if (err.name === 'OverconstrainedError') {
                setError('No se pudo acceder al micrófono con las restricciones solicitadas.');
                setMicrophoneState('Restricciones no cumplidas');
            } else {
                setError(`Error al acceder al micrófono: ${err.message}`);
                setMicrophoneState('Error');
            }
            
            isStoppingRef.current = false;
        }
    };

    // Configurar temporizador máximo como respaldo
    const configureBackupTimer = () => {
        debugLog('⏱️ Configurando tiempo máximo de grabación (10s) como respaldo', 1);
        setDetectorState('Usando temporizador de respaldo');
        
        recordingTimerRef.current = setTimeout(() => {
            debugLog('⏱️ TIEMPO MÁXIMO DE GRABACIÓN ALCANZADO (10s)', 1);
            safeStopRecording('Tiempo máximo');
        }, 10000);
    };

    // Detector simplificado usando AnimationFrame
    const configureSimpleDetector = (stream) => {
        try {
            debugLog("🔊 Configurando detector de silencio simplificado...", 1);
            setDetectorState('Configurando...');
        
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.2;
        
            analyserRef.current = analyser;
            const source = audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current = source;
            source.connect(analyser);
        
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let voiceDetected = false;
            let silenceCounter = 0;
            let activeAudioCounter = 0; // Contador para audio activo continuo
        
            // Esperamos a que se termine el beep y se inicie grabación completamente
            setTimeout(() => {
                debugLog("🔊 Iniciando bucle de detección con nuevas configuraciones...", 1);
                debugLog(`📊 Configuración: SILENCE_THRESHOLD=${SILENCE_THRESHOLD}, VOICE_THRESHOLD=${VOICE_THRESHOLD}, FFT=${analyser.fftSize}`, 1);
                debugLog(`📊 Frames para silencio: ${FRAMES_TO_CONSIDER_SILENCE}, Timeout silencio: ${SILENCE_TIMEOUT_MS}ms`, 1);
        
                animationFrameRef.current = requestAnimationFrame(function checkVolume() {
                    if (!isRecordingRef.current || isStoppingRef.current) {
                        debugLog("🛑 Bucle de detección detenido porque se está deteniendo o ya no se graba", 1);
                        return;
                    }
        
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    let nonZero = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        if (dataArray[i] > 0) {
                            sum += dataArray[i];
                            nonZero++;
                        }
                    }
        
                    const average = nonZero > 0 ? sum / nonZero : 0;
                    debugLog(`📈 Nivel promedio: ${average.toFixed(2)}`, 2);
        
                    // Actualizar UI
                    if (Math.abs(volumeAverageRef.current - average) > 1) {
                        volumeAverageRef.current = Math.round(average);
                        setVolume(Math.min(100, Math.round(average * 2)));
                    }
                    
                    // Guardar nivel para gráfico
                    frameCounterRef.current++;
                    if (frameCounterRef.current % 3 === 0) {
                        setAllLevels(prev => [...prev, Math.round(average)].slice(-20));
                    }
        
                    // Detección de voz mejorada
                    if (average >= VOICE_THRESHOLD) {
                        if (!voiceDetected) {
                            voiceDetected = true;
                            hasVoiceBeenDetectedRef.current = true;
                            debugLog("🗣️ VOZ DETECTADA", 1);
                            setDetectorState(`Voz detectada (${average.toFixed(1)})`);
                        }
                        
                        // Resetear contador de silencio
                        silenceCounter = 0;
                        activeAudioCounter++;
                        
                        // Cancelar timeout de silencio si existe
                        if (silenceTimeoutRef.current) {
                            clearTimeout(silenceTimeoutRef.current);
                            silenceTimeoutRef.current = null;
                            setSilenceDetected(false);
                            debugLog("🔊 Sonido reanudado, cancelando timeout", 2);
                        }
                    } 
                    // Detección de silencio mejorada
                    else if (voiceDetected && average < SILENCE_THRESHOLD) {
                        silenceCounter++;
                        consecutiveFramesCounterRef.current = silenceCounter;
                        
                        // Solo considerar silencio después de un período mínimo de voz activa
                        if (activeAudioCounter > 10 && silenceCounter >= FRAMES_TO_CONSIDER_SILENCE && !silenceTimeoutRef.current) {
                            debugLog(`🔇 SILENCIO DETECTADO (${silenceCounter} frames) después de ${activeAudioCounter} frames de audio activo`, 1);
                            setSilenceDetected(true);
                            setDetectorState(`Silencio detectado (${silenceCounter} frames, nivel: ${average.toFixed(1)})`);
                            
                            silenceTimeoutRef.current = setTimeout(() => {
                                debugLog("⏱️ FINALIZANDO POR SILENCIO", 1);
                                debugLog(`📊 Resumen: Frames activos=${activeAudioCounter}, Frames silencio=${silenceCounter}, Último nivel=${average.toFixed(1)}`, 1);
                                safeStopRecording("Silencio detectado automáticamente");
                            }, SILENCE_TIMEOUT_MS);
                        }
                    }
                    // Si hay sonido pero no llega al umbral de voz
                    else if (voiceDetected && average >= SILENCE_THRESHOLD) {
                        // Resetear contador de silencio
                        silenceCounter = 0;
                        
                        // Cancelar timeout de silencio si existe
                        if (silenceTimeoutRef.current) {
                            clearTimeout(silenceTimeoutRef.current);
                            silenceTimeoutRef.current = null;
                            setSilenceDetected(false);
                            debugLog("🔊 Sonido de bajo nivel detectado, cancelando timeout", 2);
                        }
                    }
        
                    animationFrameRef.current = requestAnimationFrame(checkVolume);
                });
            }, 1000); // Espera 1s tras beep
            
            // Configurar temporizador máximo de respaldo (por si acaso)
            configureBackupTimer();
        } catch (err) {
            console.error("❌ Error al configurar el detector de silencio:", err);
            debugLog(`❌ ERROR AL CONFIGURAR DETECTOR: ${err.message}`, 1);
            setDetectorState(`Error: ${err.message}`);
            
            // Usar solo el temporizador de respaldo
            configureBackupTimer();
        }
    };

    const handleStopRecording = (e) => {
        if (e) e.preventDefault();
        debugLog('🛑 Deteniendo grabación manualmente (botón)', 1);
        safeStopRecording('Manual (botón)');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        debugLog('📤 Enviando grabación...', 1);
        if (!recordingSuccess) {
            debugLog('⚠️ Error: grabación no completada', 1);
            setError('Por favor, completa la grabación antes de enviar el formulario.');
            return;
        }

        try {
            debugLog('🔄 Procesando la grabación para envío...', 1);
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            debugLog(`💾 Blob final creado: ${(audioBlob.size / 1024).toFixed(2)} KB`, 1);
            onRecordingComplete(audioBlob);
            setRecordingSuccess(false);
            setError('');
            debugLog('✅ Grabación procesada correctamente', 1);
        } catch (err) {
            console.error('Error al procesar la grabación:', err);
            debugLog(`❌ Error al procesar la grabación: ${err.message}`, 1);
            setError('Hubo un error al procesar la grabación. Por favor, inténtalo más tarde.');
        }
    };

    // Agregar el efecto para autoStart
    useEffect(() => {
        if (typeof autoStart !== 'undefined' && autoStart && !isRecording) {
            debugLog('🚦 autoStart activo, iniciando grabación automáticamente', 1);
            handleStartRecording();
        }
        // eslint-disable-next-line
    }, [autoStart]);

    return (
        <div className="voice-recorder-container bg-gray-800/80 backdrop-blur-xl rounded-xl border border-purple-500/40 p-6 shadow-2xl glow-card">
          <h3 className="text-lg font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-fuchsia-400 to-amber-400 mb-4">
            Login por Voz
          </h3>
          
          {error && (
            <div className="mb-4 p-3 bg-gray-900/60 rounded-lg border border-red-500/30">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          
          <div className="info-container mb-4 p-3 bg-gray-900/40 rounded-lg border border-purple-600/30">
            {microphoneState && (
              <div className="flex items-center mb-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                <span className="text-xs text-amber-400">Micrófono: <span className="text-purple-300">{microphoneState}</span></span>
              </div>
            )}
            
            {detectorState && (
              <div className="flex items-center">
                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                <span className="text-xs text-amber-400">Detector: <span className="text-purple-300">{detectorState}</span></span>
              </div>
            )}
          </div>
          
          {isRecording && (
            <div className="recording-status mb-4 p-4 bg-gray-900/60 rounded-lg border border-purple-500/40 shadow-lg shadow-purple-500/20">
              <div className="flex items-center">
                <div className="animate-pulse mr-3 h-4 w-4 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 shadow-lg shadow-purple-500/50"></div>
                <span className="text-md text-gray-100">
                  {silenceDetected 
                    ? "Silencio detectado... finalizando" 
                    : "Grabando... (habla claramente para iniciar)"}
                </span>
              </div>
              
              {allLevels.length > 0 && (
                <div className="mt-4 p-3 bg-gray-800/70 rounded-lg border border-amber-500/20 shadow-inner">
                  <p className="text-xs text-amber-400 mb-2">Historial de niveles de audio:</p>
                  <div className="flex h-10 items-end space-x-1 px-1">
                    {allLevels.map((level, index) => (
                      <div 
                        key={index} 
                        className={`w-2 rounded-t-sm transition-all duration-100 ${
                          level > VOICE_THRESHOLD 
                            ? 'bg-gradient-to-t from-amber-500 to-amber-300 shadow-sm shadow-amber-500/50' 
                            : level > SILENCE_THRESHOLD 
                              ? 'bg-gradient-to-t from-green-500 to-green-300 shadow-sm shadow-green-500/50' 
                              : 'bg-gradient-to-t from-purple-700 to-purple-500'
                        }`}
                        style={{height: `${Math.max(5, Math.min(100, level * 3))}%`}}
                        title={`Nivel: ${level}`}
                      ></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {DEBUG_LEVEL > 0 && debugInfo && (
            <div className="mt-4 p-3 bg-gray-900/40 rounded-lg border border-purple-500/20 text-xs font-mono text-purple-300 max-h-36 overflow-y-auto">
              <div className="flex items-center mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-amber-400">Información de depuración</span>
              </div>
              <pre className="whitespace-pre-wrap mt-2">{debugInfo}</pre>
            </div>
          )}
          
          {audioSummary && (
            <div className="mt-4 p-3 bg-gray-900/40 rounded-lg border border-amber-500/30">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="text-sm golden-text">Archivo de audio generado:</span>
              </div>
              <div className="mt-2 ml-7 text-xs text-cyan-300">
                <span className="text-amber-400">{audioSummary.size}</span> bytes (<span className="text-purple-300">{audioSummary.type}</span>)
              </div>
            </div>
          )}
          
          <div className="controls mt-6 flex flex-wrap gap-3 justify-center">
            <button 
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-full shadow-lg shadow-purple-500/30 transition-all duration-300 hover:shadow-purple-500/50 hover:-translate-y-1 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              {isRecording ? 'Detener grabación' : 'Iniciar grabación'}
            </button>
            
            <button 
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-gray-900 rounded-full shadow-lg shadow-amber-500/30 transition-all duration-300 hover:shadow-amber-500/50 hover:-translate-y-1 flex items-center" 
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
              Continuar
            </button>
          </div>
        </div>
      );
};

export default VoiceRecorder;