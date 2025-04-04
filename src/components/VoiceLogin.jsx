import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { config } from '../config';
import VoiceRecorder from './VoiceRecorder';

const VoiceLogin = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        console.log('Iniciando handleSubmit...');
        console.log('Estado actual:', { email, hasAudioBlob: !!audioBlob });

        if (!email) {
            console.log('Error: email vacío');
            setError('Por favor, ingresa tu email');
            return;
        }

        if (!audioBlob) {
            console.log('Error: audioBlob vacío');
            setError('Por favor, graba tu voz');
            return;
        }

        try {
            console.log('Creando FormData...');
            const formData = new FormData();
            formData.append('email', email);
            formData.append('voice_recording', audioBlob, 'voice.wav');

            // Verificar contenido del FormData
            console.log('Contenido del FormData:');
            for (let pair of formData.entries()) {
                console.log(pair[0] + ': ' + pair[1]);
            }

            console.log('Enviando datos de login con voz:', {
                email,
                hasVoiceRecording: !!audioBlob,
                audioBlobType: audioBlob.type,
                audioBlobSize: audioBlob.size
            });

            console.log('URL de la API:', `${config.API_URL}/auth/login-voice`);

            const response = await fetch(`${config.API_URL}/auth/login-voice`, {
                method: 'POST',
                body: formData
            });

            console.log('Respuesta recibida:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error en la respuesta:', errorData);
                throw new Error(errorData.detail || 'Error en el login con voz');
            }

            const data = await response.json();
            console.log('Login con voz exitoso:', data);

            if (!data.access_token) {
                console.error('No se recibió token en la respuesta');
                throw new Error('No se recibió token en la respuesta');
            }

            const loginData = {
                token: data.access_token,
                username: data.username,
                email: data.email
            };

            console.log('Datos de login a enviar:', loginData);
            login(loginData);
            navigate('/home');
        } catch (err) {
            console.error('Error completo:', err);
            setError(err.message || 'Ha ocurrido un error');
        }
    };

    const handleStartRecording = () => {
        console.log('Iniciando grabación...');
        setIsRecording(true);
    };

    const handleStopRecording = () => {
        console.log('Deteniendo grabación...');
        setIsRecording(false);
    };

    const handleRecordingComplete = (blob) => {
        console.log('Grabación completada:', {
            blobType: blob.type,
            blobSize: blob.size
        });
        setAudioBlob(blob);
    };

    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Correo electrónico
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                        console.log('Email cambiado:', e.target.value);
                        setEmail(e.target.value);
                    }}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Correo electrónico"
                />
            </div>

            <VoiceRecorder
                onRecordingComplete={handleRecordingComplete}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
            />

            {error && (
                <div className="text-red-500 text-sm text-center">
                    {error}
                </div>
            )}

            <div className="flex flex-col items-center space-y-4">
                <button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={!email || !audioBlob}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Iniciar sesión con voz
                </button>
            </div>
        </div>
    );
};

export default VoiceLogin; 