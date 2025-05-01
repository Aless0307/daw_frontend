import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkAuth, login as authLogin, logout as authLogout } from '../utils/auth';

// Función para logging
const logAuth = (message, data = null) => {
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[${timestamp}] AUTH: ${message}`, data);
    } else {
        console.log(`[${timestamp}] AUTH: ${message}`);
    }
};

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        console.error('[AUTH] Error: useAuth debe ser usado dentro de un AuthProvider');
        throw new Error('useAuth debe ser usado dentro de un AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initializeAuth = async () => {
            logAuth('Inicializando autenticación');
            try {
                // Primero intentar obtener datos de localStorage
                let userData = localStorage.getItem('user');
                let token = localStorage.getItem('token');
                
                // Si no hay en localStorage, intentar con sessionStorage
                if (!token) {
                    token = sessionStorage.getItem('access_token');
                    userData = sessionStorage.getItem('user');
                    
                    // Si hay token pero no hay userData, intentar recrear desde campos individuales
                    if (token && !userData) {
                        const username = sessionStorage.getItem('username');
                        const email = sessionStorage.getItem('email');
                        if (email) {
                            userData = JSON.stringify({ username: username || email, email });
                        }
                    }
                }
                
                logAuth('Datos de autenticación encontrados', { 
                    hasUserData: !!userData, 
                    hasToken: !!token,
                    source: token ? (localStorage.getItem('token') ? 'localStorage' : 'sessionStorage') : 'ninguno'
                });
                
                if (userData && token) {
                    const parsedUser = typeof userData === 'string' ? JSON.parse(userData) : userData;
                    logAuth('Usuario autenticado encontrado', { 
                        username: parsedUser.username,
                        email: parsedUser.email
                    });
                    setUser(parsedUser);
                    
                    // Asegurarse de que el token esté disponible en ambos storages
                    localStorage.setItem('token', token);
                    sessionStorage.setItem('access_token', token);
                } else {
                    logAuth('No se encontraron datos de autenticación válidos, limpiando almacenamiento');
                    // Si no hay datos válidos, limpiar todo
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    sessionStorage.removeItem('user');
                    sessionStorage.removeItem('access_token');
                    setUser(null);
                }
            } catch (error) {
                console.error('[AUTH] Error al inicializar la autenticación:', error);
                setUser(null);
            } finally {
                setLoading(false);
                logAuth('Inicialización de autenticación completada', { loading: false });
            }
        };

        initializeAuth();
    }, []);

    const login = (userData) => {
        logAuth('Iniciando proceso de login', { 
            username: userData.username,
            email: userData.email
        });
        
        try {
            // Guardar datos de usuario en ambos storages para consistencia
            const userObject = {
                username: userData.username,
                email: userData.email
            };
            
            localStorage.setItem('user', JSON.stringify(userObject));
            sessionStorage.setItem('user', JSON.stringify(userObject));
            
            // Guardar token en ambos storages
            if (userData.token) {
                localStorage.setItem('token', userData.token);
                sessionStorage.setItem('access_token', userData.token);
            }
            
            // Guardar campos individuales en sessionStorage (para compatibilidad)
            sessionStorage.setItem('sijala', 'true');
            sessionStorage.setItem('username', userData.username);
            sessionStorage.setItem('email', userData.email);
            
            logAuth('Login exitoso', { 
                username: userData.username,
                email: userData.email
            });
            
            setUser(userObject);
            
            return true;
        } catch (error) {
            console.error('[AUTH] Error durante el login:', error);
            logAuth('Error durante el login', { error: error.message });
            return false;
        }
    };

    const logout = () => {
        logAuth('Iniciando proceso de logout');
        try {
            // Limpiar datos de autenticación de ambos storages
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.removeItem('access_token');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('email');
            sessionStorage.removeItem('sijala');
            
            setUser(null);
            logAuth('Logout exitoso');
        } catch (error) {
            console.error('[AUTH] Error durante el logout:', error);
            logAuth('Error durante el logout', { error: error.message });
        }
    };

    const value = {
        user,
        loading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};