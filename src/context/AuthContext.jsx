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
        const userData = localStorage.getItem('user');
        if (userData && checkAuth()) {
            setUser(JSON.parse(userData));
        } else {
            authLogout();
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        authLogin(userData);
        setUser({
            username: userData.username,
            email: userData.email
        });
    };

    const logout = () => {
        authLogout();
        setUser(null);
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