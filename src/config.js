// Configuración del entorno
const ENV = {
    development: {
        API_URL: 'http://localhost:8003',
        FRONTEND_URL: 'http://localhost:5173'
    },
    production: {
        API_URL: 'https://daw-backend.onrender.com',
        FRONTEND_URL: 'https://daw-frontend.vercel.app'
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
        'Origin': 'https://daw-frontend.vercel.app'
    },
    mode: 'cors',
    cache: 'no-cache',
    redirect: 'follow'
}; 