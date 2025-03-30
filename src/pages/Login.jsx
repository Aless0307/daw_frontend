import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VoiceRecorder from '../components/VoiceRecorder';
import { config } from '../config';

const Login = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [voiceRecording, setVoiceRecording] = useState(null);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Si está grabando, no permitir el envío del formulario
        if (isRecording) {
            setError('Por favor, detén la grabación antes de enviar el formulario');
            return;
        }

        try {
            if (isRegistering) {
                console.log('Iniciando registro...');
                console.log('Datos del formulario:', {
                    username,
                    email,
                    password,
                    hasVoiceRecording: voiceRecording !== null
                });

                const formData = new FormData();
                formData.append('username', username);
                formData.append('email', email);
                formData.append('password', password);
                
                if (voiceRecording) {
                    formData.append('voice', voiceRecording, 'recording.wav');
                }

                // Log del FormData
                for (let pair of formData.entries()) {
                    console.log('FormData entry:', pair[0], pair[1] instanceof Blob ? 'Blob' : pair[1]);
                }

                console.log('Enviando solicitud a:', `${config.API_URL}/auth/register`);
                const response = await fetch(`${config.API_URL}/auth/register`, {
                    method: 'POST',
                    body: formData,
                    ...config.fetchOptions
                });

                console.log('Respuesta recibida:', response.status);
                const responseData = await response.json();
                console.log('Datos de respuesta:', responseData);

                if (!response.ok) {
                    throw new Error(responseData.detail || 'Error en el registro');
                }

                // Si el registro es exitoso, cambiamos a modo login
                setIsRegistering(false);
                setUsername('');
                setEmail('');
                setPassword('');
                setVoiceRecording(null);
                setError('');
                alert('Registro exitoso. Por favor, inicia sesión.');
            } else {
                console.log('Iniciando sesión...');
                const response = await fetch(`${config.API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: new URLSearchParams({
                        username: email,
                        password: password,
                    }),
                    credentials: 'include',
                    mode: 'cors'
                });

                console.log('Respuesta de login recibida:', response.status);
                const data = await response.json();
                console.log('Datos de login:', data);

                if (!response.ok) {
                    throw new Error(data.detail || 'Error en el inicio de sesión');
                }

                // Guardar el token y redirigir
                await login(data);
                console.log('Login exitoso, redirigiendo...');
                navigate('/home');
            }
        } catch (err) {
            console.error('Error:', err);
            setError(err.message);
        }
    };

    const handleVoiceRecordingComplete = (audioBlob) => {
        setVoiceRecording(audioBlob);
    };

    const handleStartRecording = () => {
        setIsRecording(true);
    };

    const handleStopRecording = () => {
        setIsRecording(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
            <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-2xl transform transition-all hover:scale-[1.01]">
                <div className="text-center">
                    <h2 className="mt-6 text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">
                        {isRegistering ? 'Crear Cuenta' : 'Bienvenido'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {isRegistering 
                            ? 'Regístrate para comenzar tu experiencia' 
                            : 'Inicia sesión en tu cuenta'}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {isRegistering && (
                            <div className="relative">
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                    Nombre de usuario
                                </label>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    disabled={isRecording}
                                    className="mt-1 block w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Tu nombre de usuario"
                                />
                            </div>
                        )}

                        <div className="relative">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isRecording}
                                className="mt-1 block w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                placeholder="tu@email.com"
                            />
                        </div>

                        <div className="relative">
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Contraseña
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isRecording}
                                className="mt-1 block w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {isRegistering && (
                        <div className="mt-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                            <VoiceRecorder
                                onRecordingComplete={handleVoiceRecordingComplete}
                                onStartRecording={handleStartRecording}
                                onStopRecording={handleStopRecording}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg bg-red-50 p-4 border border-red-100">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">
                                        {error}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={isRecording}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
                        </button>
                    </div>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => setIsRegistering(!isRegistering)}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors duration-200"
                        >
                            {isRegistering
                                ? '¿Ya tienes una cuenta? Inicia sesión'
                                : '¿No tienes una cuenta? Regístrate'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login; 