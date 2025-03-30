import { createContext, useContext, useState, useEffect } from 'react';
import { checkAuth, logout } from '../utils/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Verificar autenticación al cargar
        const userData = localStorage.getItem('user');
        if (userData && checkAuth()) {
            setUser(JSON.parse(userData));
        } else {
            localStorage.removeItem('user');
            setUser(null);
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const handleLogout = () => {
        logout();
        setUser(null);
    };

    if (loading) {
        return null; // O un componente de carga
    }

    return (
        <AuthContext.Provider value={{ user, login, logout: handleLogout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe ser usado dentro de un AuthProvider');
    }
    return context;
}; 