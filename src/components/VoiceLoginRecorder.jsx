import React, { useState, useEffect, useRef } from 'react';
import './VoiceRecorder.css';
import { config } from '../config';
import { playPredefinedMessage, playBeep } from '../services/audioService';

const VoiceLoginRecorder = ({ onRecordingComplete, onStartRecording, onStopRecording, autoStart, login, navigate }) => {
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSuccess, setRecordingSuccess] = useState(false);
    const [error, setError] = useState('');
    const [volume, setVolume] = useState(0);
    const [debugInfo, setDebugInfo] = useState('');
    const [silenceDetected, setSilenceDetected] = useState(false);
    const [allLevels, setAllLevels] = useState([]);
    const [microphoneState, setMicrophoneState] = useState('');
    const [detectorState, setDetectorState] = useState('');
    const [audioSummary, setAudioSummary] = useState(null);
    const [recordingProcessed, setRecordingProcessed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isStoppingRef = useRef(false);
    const isRecordingRef = useRef(false);
    const silenceTimeoutRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const hasProcessedAudioRef = useRef(false);
    const hasVoiceBeenDetectedRef = useRef(false);
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
    const pendingSilenceTimeoutRef = useRef(null);
    const audioChunksRef = useRef([]); // Ref para acumular chunks de audio de forma síncrona
    const recordingTimerRef = useRef(null); // Agrega la referencia faltante para evitar el error
    const SILENCE_THRESHOLD = 40;
    const VOICE_THRESHOLD = 50;
    const FRAMES_TO_CONSIDER_SILENCE = 5;
    const FRAMES_TO_START_RECORDING = 2;
    const SILENCE_TIMEOUT_MS = 800;
    const BUFFER_SIZE = 30;
    const VOICE_DEBOUNCE_TIME = 500;
    const DEBUG_LEVEL = 3;
    const debugLog = (message, level = 1) => {
        if (DEBUG_LEVEL >= level) {
            const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
            const formattedMessage = `[${timestamp}] ${message}`;
            console.log(formattedMessage);
            if (level <= 3) setDebugInfo(prev => `${formattedMessage}\n${prev}`.substring(0, 2000));
        }
    };
    useEffect(() => {
        debugLog('🔄 Componente VoiceLoginRecorder montado', 1);
        return () => {
            debugLog('🔄 Componente VoiceLoginRecorder desmontado, limpiando recursos...', 1);
            safeStopRecording('Componente desmontado');
        };
    }, []);
    useEffect(() => {
        debugLog(`🎙️ Estado de grabación: ${isRecording ? 'ACTIVO' : 'INACTIVO'}`, 1);
        isRecordingRef.current = isRecording;
    }, [isRecording]);
    useEffect(() => {
        if (typeof autoStart !== 'undefined' && autoStart && !isRecording) {
            debugLog('🚦 autoStart activo, iniciando grabación automáticamente', 1);
            handleStartRecording();
        }
    }, [autoStart]);
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
        if (testToneRef.current) {
            try {
                testToneRef.current.stop();
                testToneRef.current = null;
            } catch (error) {
                console.error('Error al detener tono de prueba:', error);
            }
        }
        if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
            try {
                debugLog(`📼 MediaRecorder activo detectado (estado: ${mediaRecorder.state}), deteniendo...`, 1);
                mediaRecorder.stop();
                if (onStopRecording) {
                    onStopRecording();
                }
                debugLog('✅ Grabación detenida correctamente', 1);
            } catch (error) {
                console.error('❌ Error al detener MediaRecorder:', error);
                debugLog(`❌ ERROR AL DETENER GRABACIÓN: ${error.message}`, 1);
            }
        }
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
        if (pendingSilenceTimeoutRef.current) {
            clearTimeout(pendingSilenceTimeoutRef.current);
            pendingSilenceTimeoutRef.current = null;
        }
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
        setAllLevels([]);
        setMicrophoneState('');
        setDetectorState('');
        debugLog("🎙️ Todos los recursos de audio liberados", 1);
        setTimeout(() => {
            isStoppingRef.current = false;
            debugLog("🔄 Listo para una nueva grabación", 2);
        }, 200);
    };
    const calculateSilenceFromBuffer = () => {
        if (audioLevelsBufferRef.current.length < 5) {
            debugLog('⚠️ Buffer de audio insuficiente para calcular silencio', 2);
            return false;
        }
        const recentLevels = audioLevelsBufferRef.current.slice(-5);
        const average = recentLevels.reduce((acc, val) => acc + val, 0) / recentLevels.length;
        const isSilent = average < SILENCE_THRESHOLD;
        debugLog(`🔍 Análisis de buffer: Promedio=${average.toFixed(2)}, Umbral=${SILENCE_THRESHOLD}, Silencio=${isSilent ? 'SÍ' : 'NO'}`, 2);
        return isSilent;
    };
    const handleStartRecording = async (e) => {
        if (e) e.preventDefault();
        if (isRecording || isStoppingRef.current) {
            debugLog('Ya estamos grabando o en proceso de detener, ignorando solicitud', 1);
            return;
        }
        debugLog('▶️ INICIANDO GRABACIÓN...', 1);
        debugLog(`📝 Navegador: ${navigator.userAgent}`, 1);
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
        setError('');
        setRecordingSuccess(false);
        setDebugInfo('');
        setSilenceDetected(false);
        setAllLevels([]);
        setMicrophoneState('Inicializando...');
        setDetectorState('Preparando...');
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
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                debugLog(`📱 Dispositivos de audio disponibles: ${audioInputs.length}`, 1);
                audioInputs.forEach((device, index) => {
                    debugLog(`📱 Micrófono ${index + 1}: ${device.label || 'Sin nombre'} (${device.deviceId.substring(0, 8)}...)`, 1);
                });
            } catch (devErr) {
                debugLog('⚠️ No se pudieron listar los dispositivos de audio', 2);
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            setMicrophoneState('Micrófono activo');
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            processorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);
            sourceRef.current.connect(analyserRef.current);
            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(audioContextRef.current.destination);
            processorRef.current.onaudioprocess = (event) => {
                const input = event.inputBuffer.getChannelData(0);
                let sum = 0.0;
                for (let i = 0; i < input.length; ++i) sum += input[i] * input[i];
                const rms = Math.sqrt(sum / input.length);
                const level = Math.min(100, Math.max(0, Math.round(rms * 1000)));
                setVolume(level);
                audioLevelsBufferRef.current.push(level);
                if (audioLevelsBufferRef.current.length > BUFFER_SIZE) audioLevelsBufferRef.current.shift();
                setAllLevels([...audioLevelsBufferRef.current]);
                if (level > VOICE_THRESHOLD) {
                    hasVoiceBeenDetectedRef.current = true;
                    setSilenceDetected(false);
                    // If we were waiting to stop due to silence, cancel it if voice resumes
                    if (pendingSilenceTimeoutRef.current) {
                        debugLog('🔊 Voz detectada durante periodo de gracia, cancelando parada por silencio', 1);
                        clearTimeout(pendingSilenceTimeoutRef.current);
                        pendingSilenceTimeoutRef.current = null;
                    }
                }
                if (hasVoiceBeenDetectedRef.current && calculateSilenceFromBuffer()) {
                    setSilenceDetected(true);
                    // Only start grace period timeout if not already started
                    if (!pendingSilenceTimeoutRef.current) {
                        debugLog('🤫 Silencio detectado tras voz. Iniciando periodo de gracia antes de detener grabación...', 1);
                        pendingSilenceTimeoutRef.current = setTimeout(() => {
                            debugLog('⏳ Silencio prolongado tras voz. Deteniendo grabación...', 1);
                            safeStopRecording('Silencio prolongado tras voz');
                            pendingSilenceTimeoutRef.current = null;
                        }, SILENCE_TIMEOUT_MS);
                    }
                }
            };
            const recorder = new window.MediaRecorder(stream);
            setMediaRecorder(recorder);
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };
            recorder.onstop = () => {
                debugLog('⏹️ Grabación detenida (onstop)', 1);
                const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                setRecordingSuccess(true);
                setAudioSummary({ size: blob.size, type: blob.type });
                // Información detallada sobre el archivo grabado
                const fileSizeKB = (blob.size / 1024).toFixed(2);
                const fileType = blob.type;
                // Crear un nombre de archivo con timestamp
                const now = new Date();
                const fileName = `voice_login_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}.wav`;
                debugLog(`✅ Archivo grabado: Nombre = ${fileName}, Tamaño = ${fileSizeKB} KB, Tipo = ${fileType}`, 1);
                debugLog(`📁 Guardado en memoria temporal del navegador (Blob en RAM, no en disco)`, 1);
                // Solo reproducir si el blob tiene datos
                if (blob.size > 100) { // 100 bytes como umbral mínimo
                    // Solo reproducir una vez: elimina la reproducción duplicada
                    debugLog('🔊 Reproduciendo el audio grabado...', 1);
                    const audioUrl = URL.createObjectURL(blob);
                    const audio = new Audio(audioUrl);
                    audio.play().catch(e => debugLog('❌ Error al reproducir audio: ' + e.message, 1));
                    audio.onended = () => handleVoiceLogin(blob);
                } else {
                    debugLog('❌ El archivo grabado está vacío o corrupto. No se reproducirá audio ni se enviará al backend.', 1);
                }
                audioChunksRef.current = [];
            };
            recorder.start();
            setIsRecording(true);
            if (onStartRecording) onStartRecording();
            debugLog('🎙️ Grabando audio...', 1);
        } catch (err) {
            debugLog(`❌ Error al iniciar grabación: ${err.message}`, 1);
            setError('No se pudo acceder al micrófono.');
            safeStopRecording('Error al iniciar grabación');
        }
    };
    const handleVoiceLogin = async (audioBlob) => {
        setError(null);
        setIsSubmitting(true);
        try {
            const email = sessionStorage.getItem('correovocal') || '';
            sessionStorage.removeItem('correovocal');
            if (!email) {
                setIsSubmitting(false);
                return;
            }
            const formData = new FormData();
            formData.append('email', email);
            // El nombre del archivo puede ser fijo o usar el timestamp generado antes
            formData.append('voice_recording', audioBlob, 'voice_login.wav');
            debugLog('📤 Enviando audio al backend para login por voz...', 1);
            const response = await fetch(`${config.API_URL}/auth/login-voice`, {
                method: 'POST',
                body: formData
            });
            debugLog('📥 Respuesta recibida del backend (login-voice)', 1);
            if (!response.ok) {
                const errData = await response.json();
                let errorMsg = 'Error en el inicio de sesión por voz';
                if (typeof errData.detail === 'string') errorMsg = errData.detail;
                else if (typeof errData.msg === 'string') errorMsg = errData.msg;
                else if (Array.isArray(errData) && errData.length && typeof errData[0].msg === 'string') errorMsg = errData[0].msg;
                else errorMsg = JSON.stringify(errData);
                debugLog('❌ Error en login por voz: ' + errorMsg, 1);
                setError(errorMsg);
                setIsSubmitting(false);
                return;
            }
            const data = await response.json();
            debugLog('✅ Login por voz exitoso. Datos recibidos: ' + JSON.stringify(data), 1);
            sessionStorage.setItem('access_token', data.access_token);
            if (!data.access_token) {
                debugLog('❌ No se recibió access_token en la respuesta.', 1);
                throw new Error('No se recibió token en la respuesta');
            }
            // Asume que tienes acceso a login y navigate vía props/context
            if (typeof login === 'function') {
                login({
                    token: data.access_token,
                    username: data.username || email,
                    email: data.email || email
                });
            }
            debugLog('➡️ Login por voz ejecutado correctamente. Redirigiendo a /home...', 1);
            if (typeof navigate === 'function') navigate('/home');
            setIsSubmitting(false);
        } catch (err) {
            debugLog('🚨 Error inesperado en login por voz: ' + err, 1);
            setError('Error al conectar con el servidor');
            setIsSubmitting(false);
        }
    };
    return (
        <div className="voice-recorder-container bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Login por Voz</h3>
            {error && <div className="text-red-600 mb-2">{error}</div>}
            {microphoneState && <div className="text-xs text-gray-500 mb-2">Micrófono: {microphoneState}</div>}
            {detectorState && <div className="text-xs text-gray-500 mb-2">Detector: {detectorState}</div>}
            {isRecording && (
                <div className="flex items-center">
                    <div className="animate-pulse mr-2 h-3 w-3 rounded-full bg-red-600"></div>
                    <span className="text-sm text-gray-600">
                        {silenceDetected 
                            ? "Silencio detectado... finalizando" 
                            : "Grabando... (habla claramente para iniciar)"}
                    </span>
                </div>
            )}
            {isRecording && allLevels.length > 0 && (
                <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Historial de niveles de audio:</p>
                    <div className="flex h-8 items-end space-x-1">
                        {allLevels.map((level, index) => (
                            <div 
                                key={index} 
                                className={`w-2 ${level > VOICE_THRESHOLD ? 'bg-blue-500' : level > SILENCE_THRESHOLD ? 'bg-green-500' : 'bg-gray-300'}`}
                                style={{height: `${Math.max(5, Math.min(100, level * 3))}%`}}
                                title={`Nivel: ${level}`}
                            ></div>
                        ))}
                    </div>
                </div>
            )}
            {DEBUG_LEVEL > 0 && debugInfo && (
                <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs font-mono text-gray-500 max-h-36 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{debugInfo}</pre>
                </div>
            )}
            {audioSummary && (
                <div className="mt-2 text-xs text-gray-500">
                    Archivo generado: {audioSummary.size} bytes ({audioSummary.type})
                </div>
            )}
        </div>
    );
};

export default VoiceLoginRecorder;
