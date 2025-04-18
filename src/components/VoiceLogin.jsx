import React, { useState, useEffect } from 'react';

const VoiceLogin = ({ onLoginSuccess, onCancel }) => {
    const [isListening, setIsListening] = useState(false);
    const [voiceRecognized, setVoiceRecognized] = useState(false);
    const [message, setMessage] = useState('Presione el botón para comenzar con el reconocimiento de voz');
    const [error, setError] = useState('');

    useEffect(() => {
        // Cleanup function cuando el componente se desmonta
        return () => {
            if (isListening) {
                stopListening();
            }
        };
    }, [isListening]);

    const startListening = async () => {
        setIsListening(true);
        setMessage('Escuchando... Por favor, diga su nombre de usuario');
        setError('');
        
        try {
            // En una implementación real, aquí iría la lógica para iniciar la grabación
            // y el procesamiento de voz utilizando la API de Web Speech o una librería similar
            
            // Simulación de procesamiento de voz
            setTimeout(() => {
                setMessage('Voz detectada. Verificando identidad...');
                setVoiceRecognized(true);
                
                // Simulación de autenticación
                setTimeout(() => {
                    // Simula una llamada exitosa a la API
                    const mockUser = {
                        username: 'usuario_de_voz',
                        email: 'usuario@ejemplo.com'
                    };
                    const mockToken = 'token-simulado-12345';
                    
                    onLoginSuccess(mockToken, mockUser);
                }, 2000);
            }, 3000);
        } catch (err) {
            setError('Error al iniciar el reconocimiento de voz: ' + err.message);
            setIsListening(false);
        }
    };

    const stopListening = () => {
        // En una implementación real, aquí iría la lógica para detener la grabación
        setIsListening(false);
        if (!voiceRecognized) {
            setMessage('Reconocimiento de voz cancelado');
        }
    };

    return (
        <div className="mt-8 space-y-6">
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}
            
            <div className="text-center">
                <div className={`p-8 mb-4 rounded-full mx-auto w-32 h-32 flex items-center justify-center ${
                    isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
                }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </div>
                
                <p className="my-4 text-lg">{message}</p>
                
                <div className="flex space-x-4 justify-center mt-6">
                    {!isListening ? (
                        <button
                            onClick={startListening}
                            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
                        >
                            Iniciar reconocimiento
                        </button>
                    ) : (
                        <button
                            onClick={stopListening}
                            className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none"
                        >
                            Detener reconocimiento
                        </button>
                    )}
                    
                    <button
                        onClick={onCancel}
                        className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VoiceLogin;