import React, { useState, useRef } from 'react';

const FaceLogin = ({ onLoginSuccess, onCancel }) => {
    const [capturing, setCapturing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState('Presione el botón para iniciar el reconocimiento facial');
    const [error, setError] = useState('');
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const startCapture = async () => {
        setError('');
        setMessage('Preparando cámara...');
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                } 
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setCapturing(true);
                setMessage('Cámara activa. Posicione su rostro en el marco y presione "Capturar".');
            }
        } catch (err) {
            setError(`No se pudo acceder a la cámara: ${err.message}`);
            console.error('Error al acceder a la cámara:', err);
        }
    };

    const stopCapture = () => {
        if (streamRef.current) {
            const tracks = streamRef.current.getTracks();
            tracks.forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        
        setCapturing(false);
        setMessage('Reconocimiento facial cancelado');
    };

    const handleCapture = async () => {
        if (!videoRef.current || !capturing) return;
        
        setProcessing(true);
        setMessage('Procesando imagen y verificando identidad...');
        
        try {
            // En una implementación real, aquí capturaríamos la imagen del video,
            // la convertiríamos a un formato adecuado y la enviaríamos al backend
            
            // Simulación de procesamiento de reconocimiento facial
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Simulación de autenticación exitosa
            const mockUser = {
                username: 'usuario_facial',
                email: 'facial@ejemplo.com'
            };
            const mockToken = 'token-facial-12345';
            
            // Detener la captura de video
            stopCapture();
            
            // Llamar a la función de éxito
            onLoginSuccess(mockToken, mockUser);
        } catch (err) {
            setError(`Error en el reconocimiento facial: ${err.message}`);
            setProcessing(false);
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
                <div className="relative w-full max-w-md mx-auto overflow-hidden rounded-lg border-2 border-gray-300 aspect-video">
                    {capturing ? (
                        <video 
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            autoPlay
                            playsInline
                            muted
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    )}
                </div>
                
                <p className="my-4 text-lg">{message}</p>
                
                <div className="flex space-x-4 justify-center mt-6">
                    {!capturing && !processing ? (
                        <button
                            onClick={startCapture}
                            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
                        >
                            Iniciar cámara
                        </button>
                    ) : capturing && !processing ? (
                        <>
                            <button
                                onClick={handleCapture}
                                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none"
                                disabled={processing}
                            >
                                Capturar
                            </button>
                            <button
                                onClick={stopCapture}
                                className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none"
                                disabled={processing}
                            >
                                Detener cámara
                            </button>
                        </>
                    ) : (
                        <button
                            disabled
                            className="px-6 py-3 bg-gray-400 text-white rounded-md"
                        >
                            Procesando...
                        </button>
                    )}
                    
                    <button
                        onClick={() => {
                            stopCapture();
                            onCancel();
                        }}
                        className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none"
                        disabled={processing}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FaceLogin;