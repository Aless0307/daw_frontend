import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkAuth, login as authLogin, logout as authLogout } from '../utils/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe ser usado dentro de un AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const userData = localStorage.getItem('user');
                const token = localStorage.getItem('token');
                
                if (userData && token && checkAuth()) {
                    const parsedUser = JSON.parse(userData);
                    setUser(parsedUser);
                } else {
                    // Si no hay datos válidos, limpiar todo
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    setUser(null);
                }
            } catch (error) {
                console.error('Error al inicializar la autenticación:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

    const login = (userData) => {
        try {
            // Guardar datos del usuario
            localStorage.setItem('user', JSON.stringify({
                username: userData.username,
                email: userData.email
            }));
            
            // Guardar token
            if (userData.token) {
                localStorage.setItem('token', userData.token);
            }
            
            // Actualizar estado
            setUser({
                username: userData.username,
                email: userData.email
            });
            
            // Llamar a la función de login
            authLogin(userData);
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            throw error;
        }
    };

    const logout = () => {
        try {
            // Limpiar datos del localStorage
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            
            // Limpiar estado
            setUser(null);
            
            // Llamar a la función de logout
            authLogout();
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}; 