import axios from './axios';

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
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiration = payload.exp * 1000; // Convertir a milisegundos
        return Date.now() < expiration;
    } catch (error) {
        return false;
    }
};

// Función para cerrar sesión
export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/#/login';
};

// Función para hacer peticiones autenticadas
export const makeAuthenticatedRequest = async (method, url, data = null) => {
    try {
        const response = await axios({
            method,
            url,
            data
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 401) {
            logout();
        }
        throw error;
    }
};

export const login = (userData) => {
    localStorage.setItem('token', userData.access_token);
    localStorage.setItem('user', JSON.stringify(userData));
}; 