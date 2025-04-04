import React, { useState, useEffect, useRef } from 'react';
import './VoiceRecorder.css';
import { config } from '../config';

const VoiceRecorder = ({ onRecordingComplete, onStartRecording, onStopRecording }) => {
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [timeLeft, setTimeLeft] = useState(5);
    const [recordingSuccess, setRecordingSuccess] = useState(false);
    const [error, setError] = useState('');
    const [audioChunks, setAudioChunks] = useState([]);

    const PHRASE = "Hola, este es mi registro de voz para la autenticación";
    const RECORDING_TIME = 5; // segundos

    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => {
                setTimeLeft((prevTime) => {
                    if (prevTime <= 1) {
                        handleStopRecording();
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const handleStartRecording = async (e) => {
        e.preventDefault();
        console.log('Iniciando grabación...');
        setError('');
        setRecordingSuccess(false);
        setAudioChunks([]);
        try {
            console.log('Solicitando acceso al micrófono...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Acceso al micrófono concedido');
            
            const recorder = new MediaRecorder(stream);
            const chunks = [];

            recorder.ondataavailable = (e) => {
                console.log('Datos de audio disponibles:', {
                    size: e.data.size,
                    type: e.data.type
                });
                chunks.push(e.data);
                setAudioChunks(chunks);
            };

            recorder.onstop = () => {
                console.log('Grabación detenida, procesando audio...');
                const blob = new Blob(chunks, { type: 'audio/wav' });
                console.log('Blob creado:', {
                    size: blob.size,
                    type: blob.type
                });
                onRecordingComplete(blob);
                setRecordingSuccess(true);
                stream.getTracks().forEach(track => track.stop());
            };

            setMediaRecorder(recorder);
            recorder.start();
            setIsRecording(true);
            setTimeLeft(RECORDING_TIME);
            onStartRecording();
            console.log('Grabación iniciada correctamente');
        } catch (err) {
            console.error('Error al acceder al micrófono:', err);
            setError('Error al acceder al micrófono. Por favor, asegúrate de que tienes un micrófono conectado y has dado los permisos necesarios.');
        }
    };

    const handleStopRecording = (e) => {
        if (e) e.preventDefault();
        console.log('Deteniendo grabación...');
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            setIsRecording(false);
            onStopRecording();
            
            // Detener todos los tracks del stream
            if (mediaRecorder.stream) {
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
            console.log('Grabación detenida correctamente');
        } else {
            console.log('No hay grabación activa para detener');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Procesando grabación...');
        if (!recordingSuccess) {
            console.log('Error: grabación no completada');
            setError('Por favor, completa la grabación antes de enviar el formulario.');
            return;
        }

        try {
            console.log('Creando blob final...');
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            console.log('Blob final creado:', {
                size: audioBlob.size,
                type: audioBlob.type
            });
            onRecordingComplete(audioBlob);
            setRecordingSuccess(false);
            setError('');
            console.log('Grabación procesada correctamente');
        } catch (err) {
            console.error('Error al procesar la grabación:', err);
            setError('Hubo un error al procesar la grabación. Por favor, inténtalo más tarde.');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Registro de Voz</h3>
            
            <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Por favor, lee la siguiente frase:</p>
                <p className="text-md font-medium text-gray-800 p-3 bg-gray-50 rounded">{PHRASE}</p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{typeof error === 'string' ? error : 'Error desconocido'}</p>
                </div>
            )}

            {recordingSuccess && !isRecording && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-600">¡Grabación completada con éxito! Ya puedes enviar el formulario.</p>
                </div>
            )}

            <div className="flex items-center justify-between">
                <button
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    className={`px-4 py-2 rounded-md font-medium ${
                        isRecording
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    type="button"
                >
                    {isRecording ? 'Detener Grabación' : 'Iniciar Grabación'}
                </button>

                {isRecording && (
                    <div className="flex items-center">
                        <div className="animate-pulse mr-2 h-3 w-3 rounded-full bg-red-600"></div>
                        <span className="text-sm text-gray-600">Tiempo restante: {timeLeft}s</span>
                    </div>
                )}
            </div>

            <div className="mt-4">
                <button
                    onClick={handleSubmit}
                    className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-700 text-white"
                    type="submit"
                >
                    Enviar Grabación
                </button>
            </div>
        </div>
    );
};

export default VoiceRecorder; 