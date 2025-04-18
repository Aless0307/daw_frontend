import { config } from '../config';

// Variable para controlar si hay un audio reproduciéndose actualmente
let isAudioPlaying = false;
// Registro de los últimos audios reproducidos para evitar repeticiones inmediatas
const recentlyPlayedAudios = new Set();
// Tiempo mínimo entre reproducciones del mismo audio (en ms)
const AUDIO_REPLAY_COOLDOWN = 2500; // Aumentado para evitar duplicaciones
// Variable para almacenar la promesa actual de reproducción
let currentPlayPromise = Promise.resolve();
// Registro de solicitudes en curso para evitar duplicación
const pendingAudioRequests = new Set();

// Función para reproducir un archivo de audio
export const playAudioFile = async (audioFileName) => {
    try {
        // Si este audio ya está en proceso de ser reproducido, no duplicar la solicitud
        if (pendingAudioRequests.has(audioFileName)) {
            console.log(`[AudioService] Ya hay una solicitud pendiente para: ${audioFileName}, ignorando duplicado`);
            return Promise.resolve();
        }
        
        // Si este audio se reprodujo recientemente, ignorarlo para evitar duplicados
        if (recentlyPlayedAudios.has(audioFileName)) {
            console.log(`[AudioService] Audio '${audioFileName}' reproducido recientemente, ignorando`);
            return Promise.resolve();
        }

        // Marcar esta solicitud como pendiente
        pendingAudioRequests.add(audioFileName);
        
        console.log(`[AudioService] Intentando reproducir: ${audioFileName}`);
        
        // Esperar a que termine cualquier reproducción en curso
        await currentPlayPromise;
        
        // Si después de esperar, el audio ya se está reproduciendo o ya se reprodujo recientemente, salir
        if (isAudioPlaying || recentlyPlayedAudios.has(audioFileName)) {
            console.log(`[AudioService] Condiciones cambiaron mientras esperaba, cancelando reproducción: ${audioFileName}`);
            pendingAudioRequests.delete(audioFileName);
            return Promise.resolve();
        }
        
        // Marcar que estamos reproduciendo
        isAudioPlaying = true;
        
        // Agregar al conjunto de reproducidos recientemente
        recentlyPlayedAudios.add(audioFileName);
        // Programar la eliminación del conjunto después del tiempo de espera
        setTimeout(() => {
            recentlyPlayedAudios.delete(audioFileName);
        }, AUDIO_REPLAY_COOLDOWN);
        
        // Crear la URL completa del archivo de audio
        const audioUrl = `${window.location.origin}/audio/${audioFileName}.mp3`;
        console.log(`[AudioService] URL completa: ${audioUrl}`);
        
        // Verificar si el archivo existe haciendo una petición HEAD
        try {
            const checkResponse = await fetch(audioUrl, { method: 'HEAD' });
            if (!checkResponse.ok) {
                console.error(`[AudioService] El archivo de audio no existe o no es accesible: ${audioUrl}`);
                isAudioPlaying = false;
                pendingAudioRequests.delete(audioFileName);
                throw new Error(`El archivo de audio ${audioFileName} no existe o no es accesible`);
            }
            console.log(`[AudioService] Archivo encontrado: ${audioUrl}`);
        } catch (fetchError) {
            console.error(`[AudioService] Error al verificar el archivo: ${fetchError}`);
            // Continúa intentando reproducir incluso si la verificación falla
        }
        
        // Crear un elemento de audio
        const audio = new Audio(audioUrl);
        
        // Añadir más eventos para depuración
        audio.addEventListener('canplaythrough', () => {
            console.log(`[AudioService] Audio listo para reproducir: ${audioFileName}`);
        });
        
        audio.addEventListener('playing', () => {
            console.log(`[AudioService] Reproduciendo audio: ${audioFileName}`);
        });
        
        // Crear una nueva promesa para esta reproducción
        const playPromise = new Promise((resolve, reject) => {
            audio.onended = () => {
                console.log(`[AudioService] Audio finalizado: ${audioFileName}`);
                isAudioPlaying = false; // Marcar que hemos terminado
                pendingAudioRequests.delete(audioFileName);
                resolve();
            };
            
            audio.onerror = (event) => {
                const error = event.target.error;
                const errorMsg = error 
                    ? `Código: ${error.code}, Mensaje: ${error.message}` 
                    : 'Error desconocido';
                    
                console.error(`[AudioService] Error al reproducir audio ${audioFileName}: ${errorMsg}`);
                isAudioPlaying = false; // Asegurarse de liberar la bandera incluso en caso de error
                pendingAudioRequests.delete(audioFileName);
                reject(new Error(`Error al reproducir ${audioFileName}: ${errorMsg}`));
            };
            
            // Reproducir el audio
            const actualPlayPromise = audio.play();
            
            if (actualPlayPromise !== undefined) {
                actualPlayPromise
                    .then(() => {
                        console.log(`[AudioService] Reproducción iniciada: ${audioFileName}`);
                    })
                    .catch(error => {
                        console.error(`[AudioService] Error en play(): ${audioFileName}`, error);
                        isAudioPlaying = false; // Liberar la bandera en caso de error
                        pendingAudioRequests.delete(audioFileName);
                        reject(error);
                    });
            }
        });
        
        // Actualizar la promesa actual
        currentPlayPromise = playPromise;
        
        // Devolver la promesa
        return playPromise;
    } catch (error) {
        console.error('[AudioService] Error general al reproducir audio:', error);
        isAudioPlaying = false; // Asegurarse de liberar la bandera en caso de error
        pendingAudioRequests.delete(audioFileName);
        throw error;
    }
};

// Audio para indicar que el usuario puede comenzar a hablar (beep)
export const playBeep = async () => {
    try {
        // Crear un contexto de audio
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Configurar el oscilador para un beep agudo pero no molesto
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // Nota A5
        
        // Configurar la ganancia para un fade in/out suave
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
        
        // Conectar los nodos
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Iniciar y detener el oscilador
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
        
        // Esperar a que termine el beep
        return new Promise(resolve => {
            setTimeout(() => {
                resolve();
                audioContext.close();
            }, 300);
        });
    } catch (error) {
        console.error('[AudioService] Error al reproducir beep:', error);
        return Promise.resolve(); // Continuar aunque falle el beep
    }
};

// Función para reproducir un mensaje predefinido
export const playPredefinedMessage = async (messageKey) => {
    try {
        console.log(`[AudioService] Reproduciendo mensaje predefinido: ${messageKey}`);
        return await playAudioFile(messageKey);
    } catch (error) {
        console.error(`[AudioService] Error en playPredefinedMessage para ${messageKey}:`, error);
        throw error;
    }
};

// Función para sintetizar texto a voz (mantenida para compatibilidad)
export const synthesizeSpeech = async (text) => {
    // Esta función ya no se usa, pero la mantenemos para compatibilidad
    console.warn('[AudioService] synthesizeSpeech está obsoleta. Usa playPredefinedMessage en su lugar.');
    return null;
};

// Función para reproducir audio (mantenida para compatibilidad)
export const playAudio = async (audioBlob) => {
    // Esta función ya no se usa, pero la mantenemos para compatibilidad
    console.warn('[AudioService] playAudio está obsoleta. Usa playPredefinedMessage en su lugar.');
    return null;
};