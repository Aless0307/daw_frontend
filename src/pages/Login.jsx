import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from "../url";
import { useNavigate } from 'react-router-dom';
import { checkAuth } from '../utils/auth';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        username: ''
    });
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Verificar si ya está autenticado
    useEffect(() => {
        if (checkAuth()) {
            navigate('/home');
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});
        setMessage('');
        setIsLoading(true);

        if (!isLogin) {
            // Validaciones para registro
            if (formData.password !== formData.confirmPassword) {
                setErrors({ confirmPassword: 'Las contraseñas no coinciden' });
                setIsLoading(false);
                return;
            }
            if (formData.password.length < 6) {
                setErrors({ password: 'La contraseña debe tener al menos 6 caracteres' });
                setIsLoading(false);
                return;
            }
        }

        try {
            if (isLogin) {
                const response = await axios.post(`${API_URL}/login`, {
                    email: formData.email,
                    password: formData.password
                });

                // Usar el contexto para el login
                login(response.data);
                
                // Redirigir a Home
                navigate('/home');
            } else {
                const response = await axios.post(`${API_URL}/register`, {
                    username: formData.username,
                    email: formData.email,
                    password: formData.password
                });
                
                setMessage(response.data.message);
                setIsLogin(true);
                setFormData({
                    email: "",
                    password: "",
                    confirmPassword: "",
                    username: ""
                });
            }
        } catch (error) {
            if (error.response) {
                setErrors({ submit: error.response.data.detail });
            } else {
                setErrors({ submit: 'Error al procesar la solicitud' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const toggleForm = () => {
        setIsLogin(!isLogin);
        setFormData({
            email: '',
            password: '',
            confirmPassword: '',
            username: ''
        });
        setErrors({});
        setMessage('');
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-full max-w-md mx-4 bg-gradient-to-b from-slate-900 to-black rounded-3xl p-8">
                <h1 className="text-4xl font-bold text-white text-center mb-8">
                    {isLogin ? 'Iniciar Sesión' : 'Registro'}
                </h1>

                {message && (
                    <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-center">
                        {message}
                    </div>
                )}

                {errors.submit && (
                    <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-center">
                        {errors.submit}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {!isLogin && (
                        <div>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="Nombre de usuario"
                                className="w-full px-4 py-3 bg-slate-900/50 border border-cyan-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
                                required
                            />
                        </div>
                    )}
                    
                    <div>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Correo electrónico"
                            className="w-full px-4 py-3 bg-slate-900/50 border border-cyan-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
                            required
                        />
                    </div>

                    <div>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Contraseña"
                            className="w-full px-4 py-3 bg-slate-900/50 border border-cyan-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
                            required
                        />
                        {errors.password && (
                            <p className="mt-1 text-sm text-red-400">{errors.password}</p>
                        )}
                    </div>

                    {!isLogin && (
                        <div>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Confirmar contraseña"
                                className="w-full px-4 py-3 bg-slate-900/50 border border-cyan-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
                                required
                            />
                            {errors.confirmPassword && (
                                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-800 hover:from-cyan-500 hover:to-cyan-700 text-white font-semibold rounded-xl transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isLoading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={toggleForm}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg transition-colors duration-300"
                    >
                        {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                    </button>
                </div>
            </div>
        </div>
    );
} 