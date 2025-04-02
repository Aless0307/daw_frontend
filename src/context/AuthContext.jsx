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
                const userData = localStorage.getItem('user');
                const token = localStorage.getItem('token');
                
                logAuth('Datos de autenticación encontrados', { 
                    hasUserData: !!userData, 
                    hasToken: !!token 
                });
                
                if (userData && token && checkAuth()) {
                    const parsedUser = JSON.parse(userData);
                    logAuth('Usuario autenticado encontrado', { 
                        username: parsedUser.username,
                        email: parsedUser.email
                    });
                    setUser(parsedUser);
                } else {
                    logAuth('No se encontraron datos de autenticación válidos, limpiando almacenamiento');
                    // Si no hay datos válidos, limpiar todo
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
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
            // Guardar datos del usuario
            localStorage.setItem('user', JSON.stringify({
                username: userData.username,
                email: userData.email
            }));
            
            // Guardar token
            localStorage.setItem('token', userData.access_token);
            
            logAuth('Login exitoso', { 
                username: userData.username,
                email: userData.email
            });
            
            setUser({
                username: userData.username,
                email: userData.email
            });
            
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
            // Limpiar datos de autenticación
            localStorage.removeItem('token');
            localStorage.removeItem('user');
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