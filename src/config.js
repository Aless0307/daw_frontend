// Configuración del entorno
const ENV = {
    development: {
        API_URL: 'http://localhost:8003',
        FRONTEND_URL: 'http://localhost:5173',
        AWS_REGION: 'us-east-1',
        GROQ_API_URL: 'https://api.groq.com/v1',
        VOICE_ID: 'Lucia', // Voz en español de Amazon Polly
        ACTIVATION_PHRASE: 'hey asistente'
    },
    production: {
        API_URL: 'https://dawbackend-production.up.railway.app',
        FRONTEND_URL: 'https://daw-frontend.vercel.app',
        AWS_REGION: 'us-east-1',
        GROQ_API_URL: 'https://api.groq.com/v1',
        VOICE_ID: 'Lucia',
        ACTIVATION_PHRASE: 'hey asistente'
    }
};

// Seleccionar el entorno basado en la URL actual
const isProduction = window.location.hostname !== 'localhost';
const currentEnv = isProduction ? 'production' : 'development';

// Exportar la configuración actual
export const config = ENV[currentEnv];

// Configuración de fetch
export const fetchOptions = {
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    mode: 'cors',
    cache: 'no-cache',
    redirect: 'follow',
    timeout: 10000 // 10 segundos
};

// Función para verificar la disponibilidad del backend
export const checkBackendAvailability = async () => {
    try {
        const response = await fetch(`${config.API_URL}/`, {
            ...fetchOptions,
            method: 'HEAD'
        });
        return response.ok;
    } catch (error) {
        console.error('[CONFIG] Error al verificar disponibilidad del backend:', error);
        return false;
    }
}; 