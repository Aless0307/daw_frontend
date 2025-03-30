import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VoiceRecorder from '../components/VoiceRecorder';
import VoiceLogin from '../components/VoiceLogin';
import { config } from '../config';

const Login = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [showVoiceLogin, setShowVoiceLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (isRegistering) {
                const formData = new FormData();
                formData.append('username', username);
                formData.append('email', email);
                formData.append('password', password);
                
                if (audioBlob) {
                    formData.append('voice', audioBlob, 'voice.wav');
                }

                console.log('Enviando datos de registro:', {
                    username,
                    email,
                    hasPassword: !!password,
                    hasVoiceRecording: !!audioBlob
                });

                const response = await fetch(`${config.API_URL}/auth/register`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Error en el registro');
                }

                const data = await response.json();
                console.log('Registro exitoso:', data);
                setIsRegistering(false);
                setEmail('');
                setPassword('');
                setUsername('');
                setAudioBlob(null);
                setError('Registro exitoso. Por favor, inicia sesión.');
            } else {
                const formData = new URLSearchParams();
                formData.append('username', email);
                formData.append('password', password);

                const response = await fetch(`${config.API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Error en el inicio de sesión');
                }

                const data = await response.json();
                console.log('Respuesta del login:', data);
                
                if (!data.access_token) {
                    throw new Error('No se recibió token en la respuesta');
                }

                const loginData = {
                    token: data.access_token,
                    username: data.username || email,
                    email: data.email || email
                };

                console.log('Datos de login a enviar:', loginData);
                login(loginData);
                navigate('/home');
            }
        } catch (err) {
            console.error('Error:', err);
            setError(err.message || 'Ha ocurrido un error');
        }
    };

    const handleVoiceRecordingComplete = (audioBlob) => {
        setAudioBlob(audioBlob);
    };

    const handleStartRecording = () => {
        setIsRecording(true);
    };

    const handleStopRecording = () => {
        setIsRecording(false);
    };

    const handleVoiceLoginSuccess = (token, user) => {
        login({
            token: token,
            username: user.username,
            email: user.email
        });
        navigate('/home');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        {isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        {isRegistering ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}{' '}
                        <button
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setShowVoiceLogin(false);
                            }}
                            className="font-medium text-indigo-600 hover:text-indigo-500"
                        >
                            {isRegistering ? 'Iniciar sesión' : 'Registrarse'}
                        </button>
                    </p>
                </div>

                {!showVoiceLogin ? (
                    <>
                        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                            <div className="rounded-md shadow-sm -space-y-px">
                                {isRegistering && (
                                    <div>
                                        <label htmlFor="username" className="sr-only">
                                            Nombre de usuario
                                        </label>
                                        <input
                                            id="username"
                                            name="username"
                                            type="text"
                                            required
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                            placeholder="Nombre de usuario"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="email" className="sr-only">
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${
                                            isRegistering ? 'rounded-none' : 'rounded-t-md'
                                        } focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                        placeholder="Correo electrónico"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="sr-only">
                                        Contraseña
                                    </label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                        placeholder="Contraseña"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="text-red-500 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <div>
                                <button
                                    type="submit"
                                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    {isRegistering ? 'Registrarse' : 'Iniciar sesión'}
                                </button>
                            </div>
                        </form>

                        {!isRegistering && (
                            <div className="mt-6">
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-white text-gray-500">O</span>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <button
                                        onClick={() => setShowVoiceLogin(true)}
                                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                    >
                                        Iniciar sesión con voz
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mt-8">
                        <VoiceLogin onLoginSuccess={handleVoiceLoginSuccess} />
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => setShowVoiceLogin(false)}
                                className="text-sm text-indigo-600 hover:text-indigo-500"
                            >
                                Volver al login normal
                            </button>
                        </div>
                    </div>
                )}

                {isRegistering && (
                    <div className="mt-8">
                        <div className="text-center mb-4">
                            <p className="text-sm text-gray-600">Grabación de voz (opcional)</p>
                            <p className="text-xs text-gray-500">Te permitirá iniciar sesión usando tu voz en el futuro</p>
                        </div>
                        <VoiceRecorder
                            onRecordingComplete={handleVoiceRecordingComplete}
                            onStartRecording={handleStartRecording}
                            onStopRecording={handleStopRecording}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login; 