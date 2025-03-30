import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkAuth, makeAuthenticatedRequest } from '../utils/auth';

export default function Home() {
    const [userData, setUserData] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Verificar autenticación
        if (!checkAuth()) {
            navigate('/login');
            return;
        }

        // Obtener datos del usuario
        const user = JSON.parse(localStorage.getItem('user'));
        setUserData(user);

        // Ejemplo de petición autenticada
        const fetchUserData = async () => {
            try {
                // Aquí podrías hacer una petición autenticada para obtener datos adicionales
                // const data = await makeAuthenticatedRequest('/api/user/profile');
                // setUserData(prev => ({ ...prev, ...data }));
            } catch (error) {
                console.error('Error al obtener datos del usuario:', error);
            }
        };

        fetchUserData();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (!userData) {
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
                        <span className="font-semibold">Usuario:</span> {userData.username}
                    </p>
                    <p className="text-cyan-400 text-lg">
                        <span className="font-semibold">Email:</span> {userData.email}
                    </p>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-300"
                >
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
} 