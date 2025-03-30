import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
    const [userData, setUserData] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Obtener los datos del usuario del localStorage
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            navigate('/login');
            return;
        }
        setUserData(user);
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