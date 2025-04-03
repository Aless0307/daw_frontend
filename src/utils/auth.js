import axios from './axios';

const AUTH_KEY = 'auth_data';

// Función para logging
const logAuth = (message, data = null) => {
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[${timestamp}] AUTH_UTILS: ${message}`, data);
    } else {
        console.log(`[${timestamp}] AUTH_UTILS: ${message}`);
    }
};

export const setAuthData = (data) => {
    try {
        localStorage.setItem(AUTH_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error al guardar datos de autenticación:', error);
        return false;
    }
};

export const getAuthData = () => {
    try {
        const data = localStorage.getItem(AUTH_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error al obtener datos de autenticación:', error);
        return null;
    }
};

export const clearAuthData = () => {
    try {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem('token');
        return true;
    } catch (error) {
        console.error('Error al limpiar datos de autenticación:', error);
        return false;
    }
};

export const isAuthenticated = () => {
    const authData = getAuthData();
    if (!authData) return false;

    const { token, expiresAt } = authData;
    if (!token || !expiresAt) return false;

    const now = new Date().getTime();
    return now < expiresAt;
};

// Verificar si el token está expirado
export const isTokenExpired = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        logAuth('Token no encontrado');
        return true;
    }
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        logAuth('Verificación de expiración de token', { 
            expiraEn: new Date(payload.exp * 1000).toISOString(),
            estaExpirado: isExpired
        });
        return isExpired;
    } catch (error) {
        console.error('[AUTH_UTILS] Error al verificar expiración del token:', error);
        return true;
    }
};

// Obtener tiempo restante hasta la expiración del token
const getTokenExpirationTime = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        logAuth('Token no encontrado para calcular tiempo de expiración');
        return 0;
    }
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const remainingTime = payload.exp * 1000 - Date.now();
        logAuth('Tiempo restante hasta expiración del token', { 
            tiempoRestanteMs: remainingTime,
            expiraEn: new Date(payload.exp * 1000).toISOString()
        });
        return remainingTime;
    } catch (error) {
        console.error('[AUTH_UTILS] Error al calcular tiempo de expiración del token:', error);
        return 0;
    }
};

// Verificar autenticación general
export const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        logAuth('Token no encontrado para verificación de autenticación');
        return false;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiration = payload.exp * 1000; // Convertir a milisegundos
        const isValid = Date.now() < expiration;
        
        logAuth('Verificación de autenticación', { 
            expiraEn: new Date(expiration).toISOString(),
            esValido: isValid
        });
        
        return isValid;
    } catch (error) {
        console.error('[AUTH_UTILS] Error al verificar autenticación:', error);
        return false;
    }
};

// Función para cerrar sesión
export const logout = async () => {
    try {
        await axios.post('/auth/logout');
        clearAuthData();
        return { success: true };
    } catch (error) {
        console.error('Error en logout:', error);
        return { success: false, error: error.response?.data?.message || 'Error al cerrar sesión' };
    }
};

// Función para hacer peticiones autenticadas
export const makeAuthenticatedRequest = async (method, url, data = null) => {
    logAuth('Iniciando petición autenticada', { method, url });
    
    try {
        // Verificar si el token está expirado
        if (isTokenExpired()) {
            logAuth('Token expirado, redirigiendo a login');
            logout();
            window.location.href = '/#/login';
            return null;
        }
        
        // Obtener token
        const token = localStorage.getItem('token');
        
        // Configurar headers
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        // Realizar petición
        const response = await axios({
            method,
            url,
            data,
            headers
        });
        
        logAuth('Petición autenticada exitosa', { 
            method, 
            url, 
            status: response.status 
        });
        
        return response.data;
    } catch (error) {
        console.error('[AUTH_UTILS] Error en petición autenticada:', error);
        logAuth('Error en petición autenticada', { 
            method, 
            url, 
            error: error.message 
        });
        
        if (error.response?.status === 401) {
            logAuth('Error de autenticación (401), redirigiendo a login');
            logout();
            window.location.href = '/#/login';
        }
        
        throw error;
    }
};

// Función para iniciar sesión
export const login = async (email, password) => {
    try {
        const response = await axios.post('/auth/login', { email, password });
        const { token, user } = response.data;
        
        const expiresAt = new Date().getTime() + (60 * 60 * 1000); // 1 hora
        setAuthData({ token, user, expiresAt });
        
        return { success: true, user };
    } catch (error) {
        console.error('Error en login:', error);
        return { success: false, error: error.response?.data?.message || 'Error al iniciar sesión' };
    }
};

export const register = async (userData) => {
    try {
        const response = await axios.post('/auth/register', userData);
        const { token, user } = response.data;
        
        const expiresAt = new Date().getTime() + (60 * 60 * 1000); // 1 hora
        setAuthData({ token, user, expiresAt });
        
        return { success: true, user };
    } catch (error) {
        console.error('Error en registro:', error);
        return { success: false, error: error.response?.data?.message || 'Error al registrar usuario' };
    }
}; 