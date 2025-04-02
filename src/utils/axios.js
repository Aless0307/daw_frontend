import axios from 'axios';
import { API_URL } from '../url';

// Función para logging
const logRequest = (config) => {
    console.log(`[${new Date().toISOString()}] REQUEST: ${config.method.toUpperCase()} ${config.url}`);
    console.log(`[${new Date().toISOString()}] Headers:`, config.headers);
    if (config.data) {
        console.log(`[${new Date().toISOString()}] Data:`, config.data);
    }
};

const logResponse = (response) => {
    console.log(`[${new Date().toISOString()}] RESPONSE: ${response.status} ${response.statusText}`);
    console.log(`[${new Date().toISOString()}] Data:`, response.data);
};

const logError = (error) => {
    console.error(`[${new Date().toISOString()}] ERROR: ${error.message}`);
    if (error.response) {
        console.error(`[${new Date().toISOString()}] Status: ${error.response.status}`);
        console.error(`[${new Date().toISOString()}] Data:`, error.response.data);
    }
};

const instance = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Interceptor para agregar el token a las peticiones
instance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        logRequest(config);
        return config;
    },
    (error) => {
        logError(error);
        return Promise.reject(error);
    }
);

// Interceptor para manejar errores de autenticación
instance.interceptors.response.use(
    (response) => {
        logResponse(response);
        return response;
    },
    (error) => {
        logError(error);
        if (error.response?.status === 401) {
            console.log(`[${new Date().toISOString()}] Sesión expirada, redirigiendo a login`);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/#/login';
        }
        return Promise.reject(error);
    }
);

export default instance; 