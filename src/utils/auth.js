import axios from 'axios';
import { API_URL } from '../url';
import { useEffect } from 'react';

// Verificar si el token está expirado
export const isTokenExpired = () => {
    const user = localStorage.getItem('user');
    if (!user) return true;
    
    try {
        const userData = JSON.parse(user);
        const token = userData.access_token;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch (error) {
        return true;
    }
};

// Obtener tiempo restante hasta la expiración del token
const getTokenExpirationTime = () => {
    const user = localStorage.getItem('user');
    if (!user) return 0;
    
    try {
        const userData = JSON.parse(user);
        const token = userData.access_token;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 - Date.now();
    } catch (error) {
        return 0;
    }
};

// Verificar autenticación general
export const checkAuth = () => {
    const user = localStorage.getItem('user');
    if (!user) return false;
    
    try {
        const userData = JSON.parse(user);
        const token = userData.access_token;
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Verificar expiración
        if (payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('user');
            return false;
        }
        
        return true;
    } catch (error) {
        localStorage.removeItem('user');
        return false;
    }
};

// Función para cerrar sesión
export const logout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
};

// Configurar interceptor de Axios
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            logout();
        }
        return Promise.reject(error);
    }
);

// Función para hacer peticiones autenticadas
export const makeAuthenticatedRequest = async (endpoint, method = 'GET', data = null) => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) throw new Error('No autenticado');

    const headers = {
        'Authorization': `Bearer ${user.access_token}`
    };
    
    try {
        const response = await axios({
            method,
            url: `${API_URL}${endpoint}`,
            data,
            headers
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 401) {
            logout();
        }
        throw error;
    }
};

// Hook personalizado para manejar la expiración del token
export const useTokenExpiration = () => {
    useEffect(() => {
        // Verificar inmediatamente al montar el componente
        if (isTokenExpired()) {
            logout();
            return;
        }

        // Calcular tiempo restante hasta la expiración
        const timeUntilExpiration = getTokenExpirationTime();
        
        // Si el token expirará en menos de 1 segundo, cerrar sesión inmediatamente
        if (timeUntilExpiration <= 1000) {
            logout();
            return;
        }

        // Configurar un único temporizador que se activará justo cuando expire el token
        const timer = setTimeout(() => {
            logout();
        }, timeUntilExpiration);

        // Limpiar el temporizador al desmontar el componente
        return () => clearTimeout(timer);
    }, []);
}; 