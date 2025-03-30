import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkAuth } from '../utils/auth';
import { useAuth } from '../context/AuthContext';

export default function Home() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    useEffect(() => {
        if (!checkAuth()) {
            navigate('/login');
        }
    }, [navigate]);

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-full max-w-md mx-4 bg-gradient-to-b from-slate-900 to-black rounded-3xl p-8">
                <h1 className="text-4xl font-bold text-white text-center mb-8">
                    Bienvenido
                </h1>
                
                <div className="bg-slate-900/50 rounded-xl p-6 mb-6">
                    <p className="text-cyan-400 text-lg mb-2">
                        <span className="font-semibold">Usuario:</span> {user.username}
                    </p>
                    <p className="text-cyan-400 text-lg">
                        <span className="font-semibold">Email:</span> {user.email}
                    </p>
                </div>

                <button
                    onClick={logout}
                    className="w-full py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-300"
                >
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
} 