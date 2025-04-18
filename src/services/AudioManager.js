/**
 * Clase para gestionar la reproducción de mensajes de audio en la aplicación
 */
class AudioManager {
    constructor() {
        this.messageQueue = [];
        this.isPlaying = false;
        this.audioContext = null;
        this.audioCache = {};
    }

    /**
     * Inicializa el contexto de audio (debe ser llamado después de una interacción del usuario)
     */
    initAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (error) {
                console.error("Error al inicializar AudioContext:", error);
            }
        }
        return this.audioContext;
    }

    /**
     * Añade un mensaje a la cola de reproducción
     * @param {string} messageKey - Clave del mensaje de audio a reproducir
     */
    queueMessage(messageKey) {
        if (!messageKey) return;
        
        this.messageQueue.push(messageKey);
        this.initAudioContext();
        
        if (!this.isPlaying) {
            this.playNextMessage();
        }
    }

    /**
     * Reproduce el siguiente mensaje en la cola
     */
    playNextMessage() {
        if (this.messageQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const messageKey = this.messageQueue.shift();
        this.playAudio(messageKey);
    }

    /**
     * Reproduce un archivo de audio por su clave
     * @param {string} key - Clave del mensaje a reproducir
     */
    async playAudio(key) {
        try {
            // Mapa de mensajes a URLs de audio (en una implementación real, esto podría
            // estar en un archivo de configuración o venir del backend)
            const audioUrls = {
                welcome: "/audio/welcome.mp3",
                askRegistration: "/audio/ask_registration.mp3",
                registered: "/audio/registered.mp3",
                notRegistered: "/audio/not_registered.mp3",
                listening: "/audio/listening.mp3",
                notUnderstood: "/audio/not_understood.mp3",
                goodbye: "/audio/goodbye.mp3",
                askLoginOrRegister: "/audio/ask_login_or_register.mp3",
                login: "/audio/login.mp3",
                register: "/audio/register.mp3",
                voiceLogin: "/audio/voice_login.mp3",
                faceLogin: "/audio/face_login.mp3",
                loginSuccess: "/audio/login_success.mp3",
                loginError: "/audio/login_error.mp3"
            };

            const url = audioUrls[key];
            
            if (!url) {
                console.error(`No se encontró el archivo de audio para la clave "${key}"`);
                this.playNextMessage();
                return;
            }

            // En una implementación real, aquí cargaríamos y reproduciríamos el audio
            // Sin embargo, para fines de demostración, simplemente simularemos la reproducción
            console.log(`Reproduciendo audio: ${key} (${url})`);
            
            // Simulamos la duración del audio
            const durations = {
                welcome: 3000,
                askRegistration: 2500,
                registered: 2000,
                notRegistered: 2000,
                listening: 1500,
                notUnderstood: 2000,
                goodbye: 1500,
                askLoginOrRegister: 3000,
                login: 1500,
                register: 1500,
                voiceLogin: 2000,
                faceLogin: 2000,
                loginSuccess: 2000,
                loginError: 2000
            };
            
            const duration = durations[key] || 2000;
            
            // Simula la duración de reproducción antes de pasar al siguiente mensaje
            setTimeout(() => {
                this.playNextMessage();
            }, duration);

        } catch (error) {
            console.error("Error al reproducir audio:", error);
            this.playNextMessage();
        }
    }

    /**
     * Detiene la reproducción actual y limpia la cola
     */
    stopAll() {
        this.messageQueue = [];
        this.isPlaying = false;
    }
}

export default AudioManager;