import axios from './axios';

// Verificar si el token está expirado
export const isTokenExpired = () => {
    const token = localStorage.getItem('token');
    if (!token) return true;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch (error) {
        return true;
    }
};

// Obtener tiempo restante hasta la expiración del token
const getTokenExpirationTime = () => {
    const token = localStorage.getItem('token');
    if (!token) return 0;
    
    try {
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
};

// Función para hacer peticiones autenticadas
export const makeAuthenticatedRequest = async (method, url, data = null) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No hay token de autenticación');

    try {
        const response = await axios({
            method,
            url,
            data,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 401) {
            logout();
        }
        throw error;
    }
};

// Función para iniciar sesión
export const login = (userData) => {
    if (!userData || !userData.token) {
        console.error('Datos de usuario recibidos:', userData);
        throw new Error('No se recibió token en la respuesta');
    }
    
    try {
        localStorage.setItem('token', userData.token);
        return userData;
    } catch (error) {
        console.error('Error al guardar el token:', error);
        throw error;
    }
}; 