// Configuración de URLs
//export const API_URL = 'http://localhost:8003';  // URL local
export const API_URL = 'https://daw-backend.onrender.com';  // URL de producción

// URL del frontend (para CORS)
//export const FRONTEND_URL = 'http://localhost:5173';  // URL local
export const FRONTEND_URL = 'https://daw-frontend.vercel.app';  // URL de producción

// Configuración de fetch
export const fetchOptions = {
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    mode: 'cors',
    cache: 'no-cache',
    redirect: 'follow'
}; 