import axios from 'axios';

const instance = axios.create({
    baseURL: 'https://daw-backend.onrender.com',
    withCredentials: true,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Interceptor para manejar errores
instance.interceptors.response.use(
    response => response,
    error => {
        console.error('Error en la petición:', error);
        if (error.response) {
            console.error('Respuesta del servidor:', error.response.data);
            console.error('Estado:', error.response.status);
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            console.error('No se recibió respuesta:', error.request);
        } else {
            console.error('Error al configurar la petición:', error.message);
        }
        return Promise.reject(error);
    }
);

// Interceptor para manejar tokens
instance.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        console.error('Error en la configuración de la petición:', error);
        return Promise.reject(error);
    }
);

export default instance; 