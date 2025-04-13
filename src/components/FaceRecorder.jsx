import React, { useState, useRef, useEffect } from 'react';
import './FaceRecorder.css';

// Componente FaceRecorder para registrar fotos de rostros
const FaceRecorder = ({ onPhotoComplete, onStartCapture, onStopCapture }) => {
    const [isCapturing, setIsCapturing] = useState(false); // Estado para indicar si se está capturando una foto
    const [photoSuccess, setPhotoSuccess] = useState(false); // Estado para indicar si la foto se capturó con éxito
    const [error, setError] = useState(''); // Estado para almacenar errores
    const [photoBlob, setPhotoBlob] = useState(null); // Estado para almacenar la foto capturada
    const [stability, setStability] = useState(0); // Estado para almacenar la estabilidad de la foto
    const [lightLevel, setLightLevel] = useState(0); // Estado para almacenar el nivel de luminosidad de la foto
    const videoRef = useRef(null); // Referencia al elemento <video>    
    const canvasRef = useRef(null); // Referencia al elemento <canvas>
    const previousFrameRef = useRef(null); // Referencia al frame anterior
    const stabilityTimerRef = useRef(null); // Referencia al temporizador de estabilidad
    const autoCaptureTimerRef = useRef(null); // Referencia al temporizador de captura automática
    const [isVideoReady, setIsVideoReady] = useState(false); // Estado para indicar si la cámara está lista

    // Función para calcular la diferencia entre dos frames
    const calculateFrameDifference = (currentFrame, previousFrame) => {
        if (!previousFrame || !currentFrame || !canvasRef.current) return 0;
        
        try {
            const context = canvasRef.current.getContext('2d');
            const width = currentFrame.videoWidth;
            const height = currentFrame.videoHeight;
            
            if (width <= 0 || height <= 0) return 0;
            
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            
            context.drawImage(currentFrame, 0, 0, width, height);
            const currentData = context.getImageData(0, 0, width, height).data;
            
            context.drawImage(previousFrame, 0, 0, width, height);
            const previousData = context.getImageData(0, 0, width, height).data;
            
            let diff = 0;
            for (let i = 0; i < currentData.length; i += 4) {
                diff += Math.abs(currentData[i] - previousData[i]);
            }
            return diff / (width * height);
        } catch (error) {
            console.error('Error al calcular la diferencia de frames:', error);
            return 0;
        }
    };

    // Función para medir la luminosidad
    const measureLightLevel = (frame) => {
        if (!frame || !canvasRef.current) return 0;
        
        try {
            const context = canvasRef.current.getContext('2d');
            const width = frame.videoWidth;
            const height = frame.videoHeight;
            
            if (width <= 0 || height <= 0) return 0;
            
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            
            context.drawImage(frame, 0, 0, width, height);
            const imageData = context.getImageData(0, 0, width, height).data;
            
            let totalBrightness = 0;
            let pixelCount = 0;
            
            for (let i = 0; i < imageData.length; i += 4) {
                totalBrightness += (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
                pixelCount++;
            }
            
            const averageBrightness = totalBrightness / pixelCount;
            // Normalizar el valor de brillo a un porcentaje (0-100)
            return Math.min(100, Math.max(0, (averageBrightness / 255) * 100));
        } catch (error) {
            console.error('Error al medir la luminosidad:', error);
            return 0;
        }
    };

    // Función para verificar si las condiciones son adecuadas
    const checkCaptureConditions = (frame) => {
        if (!frame || !isVideoReady) return false;
        
        const currentStability = calculateFrameDifference(frame, previousFrameRef.current);
        const currentLightLevel = measureLightLevel(frame);
        
        setStability(currentStability);
        setLightLevel(currentLightLevel);
        
        // Condiciones para captura automática:
        // - Estabilidad alta (diferencia baja entre frames)
        // - Luminosidad adecuada
        return currentStability < 5 && currentLightLevel > 30; // Devuelve true si se cumplen las condiciones
    };

    // Función para capturar la foto
    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current || !isVideoReady) return;

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                if (blob) {
                    setPhotoBlob(blob);
                    setPhotoSuccess(true);
                    if (onPhotoComplete) {
                        onPhotoComplete(blob);
                    }
                    const now = new Date();
                    console.log(`Foto capturada con éxito a las ${now.toLocaleTimeString()}`);
                } else {
                    setError('No se pudo capturar la foto');
                }
            }, 'image/jpeg', 0.95);
        } catch (error) {
            console.error('Error al capturar la foto:', error);
            setError('Error al capturar la foto');
        }
    };

    // Efecto para monitorear las condiciones y capturar automáticamente
    useEffect(() => {
        if (isCapturing && videoRef.current && isVideoReady) {
            const checkFrame = () => {
                if (checkCaptureConditions(videoRef.current)) {
                    if (!stabilityTimerRef.current) {
                        stabilityTimerRef.current = setTimeout(() => {
                            if (checkCaptureConditions(videoRef.current)) {
                                capturePhoto();
                                handleStopCapture();
                            }
                            stabilityTimerRef.current = null;
                        }, 2000); // Esperar 2 segundos de estabilidad
                    }
                } else {
                    if (stabilityTimerRef.current) {
                        clearTimeout(stabilityTimerRef.current);
                        stabilityTimerRef.current = null;
                    }
                }
                
                previousFrameRef.current = videoRef.current;
                autoCaptureTimerRef.current = requestAnimationFrame(checkFrame);
            };
            
            autoCaptureTimerRef.current = requestAnimationFrame(checkFrame);
        }
        
        return () => {
            if (stabilityTimerRef.current) {
                clearTimeout(stabilityTimerRef.current);
            }
            if (autoCaptureTimerRef.current) {
                cancelAnimationFrame(autoCaptureTimerRef.current);
            }
        };
    }, [isCapturing, isVideoReady]);

    const handleStartCapture = async () => {
        try {
            setIsCapturing(true);
            setError('');
            setPhotoSuccess(false);
            setPhotoBlob(null);
            setStability(0);
            setLightLevel(0);
            setIsVideoReady(false);

            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    setIsVideoReady(true);
                };
            }
            
            if (onStartCapture) {
                onStartCapture();
            }
        } catch (err) {
            console.error('Error al acceder a la cámara:', err);
            setError('No se pudo acceder a la cámara. Asegúrate de dar los permisos necesarios.');
            setIsCapturing(false);
        }
    };

    const handleStopCapture = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        
        setIsCapturing(false);
        setIsVideoReady(false);
        if (onStopCapture) {
            onStopCapture();
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Registro Facial</h3>
            
            <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Por favor, coloca tu rostro frente a la cámara:</p>
                <p className="text-xs text-gray-500">La foto se tomará automáticamente cuando estés listo</p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {photoSuccess && !isCapturing && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-600">¡Foto capturada con éxito! Ya puedes enviar el formulario.</p>
                </div>
            )}

            <div className="mb-4">
                {isCapturing && (
                    <div className="relative">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full rounded-lg"
                        />
                        <canvas
                            ref={canvasRef}
                            className="hidden"
                        />
                        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded">
                            <p className="text-xs">Estabilidad: {Math.round((1 - stability/5) * 100)}%</p>
                            <p className="text-xs">Luminosidad: {Math.round(lightLevel)}%</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <button
                    onClick={isCapturing ? handleStopCapture : handleStartCapture}
                    className={`px-4 py-2 rounded-md font-medium ${
                        isCapturing
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    type="button"
                >
                    {isCapturing ? 'Detener Cámara' : 'Iniciar Cámara'}
                </button>
            </div>
        </div>
    );
};

export default FaceRecorder; 