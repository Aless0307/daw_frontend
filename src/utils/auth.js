import axiosInstance from './axios';

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
    window.location.href = '/#/login';
};

// Función para hacer peticiones autenticadas
export const makeAuthenticatedRequest = async (endpoint, method = 'GET', data = null) => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) throw new Error('No autenticado');

    const headers = {
        'Authorization': `Bearer ${user.access_token}`
    };
    
    try {
        const response = await axiosInstance({
            method,
            url: endpoint,
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