import React, { useState, useRef } from 'react';
import { config } from '../config';

const VoiceLogin = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState('');
    const [recordingSuccess, setRecordingSuccess] = useState(false);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);

    const handleStartRecording = async () => {
        if (!email) {
            setError('Por favor, ingresa tu correo electrónico primero');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];

            mediaRecorder.current.ondataavailable = (event) => {
                audioChunks.current.push(event.data);
            };

            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
                await handleSubmit(audioBlob);
            };

            mediaRecorder.current.start();
            setIsRecording(true);
            setError('');
        } catch (err) {
            setError('Error al acceder al micrófono. Por favor, verifica los permisos.');
            console.error('Error accessing microphone:', err);
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.stop();
            if (mediaRecorder.current.stream) {
                mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
            }
            setIsRecording(false);
            setRecordingSuccess(true);
        }
    };

    const handleSubmit = async (audioBlob) => {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.wav');
        formData.append('email', email);

        try {
            console.log('Enviando grabación de voz para login...');
            const response = await fetch(`${config.API_URL}/auth/login-voice`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al verificar la voz');
            }

            const data = await response.json();
            console.log('Respuesta del login con voz:', data);
            
            if (data.access_token && data.user) {
                onLoginSuccess(data.access_token, data.user);
            } else {
                throw new Error('No se recibieron los datos necesarios del servidor');
            }
        } catch (err) {
            console.error('Error en login con voz:', err);
            setError(err.message || 'Error al enviar la grabación. Por favor, inténtalo de nuevo.');
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Correo electrónico
                </label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="tu@email.com"
                    disabled={isRecording}
                />
            </div>

            <div className="text-center mb-6">
                <p className="text-gray-600 mb-2">Por favor, di la siguiente frase:</p>
                <p className="text-lg font-semibold text-indigo-600">"Mi voz es mi contraseña"</p>
            </div>

            <div className="text-center">
                <button
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    className={`px-4 py-2 rounded-md text-white ${
                        isRecording 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                    disabled={!email}
                >
                    {isRecording ? 'Detener Grabación' : 'Iniciar Grabación'}
                </button>
            </div>

            {recordingSuccess && !isRecording && (
                <div className="text-center text-sm text-green-600">
                    Grabación completada. Verificando...
                </div>
            )}

            {error && (
                <div className="text-center text-sm text-red-600">
                    {error}
                </div>
            )}
        </div>
    );
};

export default VoiceLogin; 