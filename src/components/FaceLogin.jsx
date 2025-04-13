import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { config } from '../config';

const FaceLogin = ({ onLoginSuccess }) => {
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState('');
    const [photoBlob, setPhotoBlob] = useState(null);
    const [stability, setStability] = useState(0);
    const [lightLevel, setLightLevel] = useState(0);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [photoTaken, setPhotoTaken] = useState(false);
    const [email, setEmail] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const previousFrameRef = useRef(null);
    const stabilityTimerRef = useRef(null);
    const autoCaptureTimerRef = useRef(null);
    const streamRef = useRef(null);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleStopCapture = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        
        if (stabilityTimerRef.current) {
            clearTimeout(stabilityTimerRef.current);
            stabilityTimerRef.current = null;
        }
        if (autoCaptureTimerRef.current) {
            cancelAnimationFrame(autoCaptureTimerRef.current);
            autoCaptureTimerRef.current = null;
        }
        
        setIsCapturing(false);
        setIsVideoReady(false);
        setStability(0);
        setLightLevel(0);
    }, []);

    const handleStartCapture = useCallback(async () => {
        if (isCapturing) return;

        try {
            setIsCapturing(true);
            setError('');
            setPhotoBlob(null);
            setStability(0);
            setLightLevel(0);
            setIsVideoReady(false);

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            });
            
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    setIsVideoReady(true);
                };
            } else {
                setError('Error al inicializar la cámara');
                handleStopCapture();
            }
        } catch (err) {
            setError('No se pudo acceder a la cámara. Asegúrate de dar los permisos necesarios.');
            handleStopCapture();
        }
    }, [isCapturing, handleStopCapture]);

    const calculateFrameDifference = useCallback((currentFrame, previousFrame) => {
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
            return 0;
        }
    }, []);

    const measureLightLevel = useCallback((frame) => {
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
            return Math.min(100, Math.max(0, (averageBrightness / 255) * 100));
        } catch (error) {
            return 0;
        }
    }, []);

    const checkCaptureConditions = useCallback((frame) => {
        if (!frame || !isVideoReady) return false;
        
        const currentStability = calculateFrameDifference(frame, previousFrameRef.current);
        const currentLightLevel = measureLightLevel(frame);
        
        setStability(currentStability);
        setLightLevel(currentLightLevel);
        
        return currentStability < 5 && currentLightLevel > 30;
    }, [calculateFrameDifference, measureLightLevel, isVideoReady]);

    const capturePhoto = useCallback(() => {
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
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        localStorage.setItem('faceLoginPhoto', reader.result);
                        console.log('Foto guardada en localStorage');
                        setPhotoTaken(true);
                        handleStopCapture();
                    };
                    reader.readAsDataURL(blob);
                } else {
                    setError('No se pudo capturar la foto');
                }
            }, 'image/jpeg', 0.95);
        } catch (error) {
            setError('Error al capturar la foto');
        }
    }, [isVideoReady, handleStopCapture]);

    const handleRetry = useCallback(() => {
        setPhotoTaken(false);
        setPhotoBlob(null);
        setSuccessMessage('');
        handleStartCapture();
    }, [handleStartCapture]);

    const handleLogin = async () => {
        if (!email) {
            setError('Por favor ingresa tu correo electrónico');
            return;
        }

        if (!photoBlob) {
            setError('Por favor toma una foto');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('email', email);
        formData.append('face_photo', photoBlob, 'face.jpg');

        try {
            const response = await fetch(`${config.API_URL}/auth/login_face`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error en la autenticación facial');
            }

            const data = await response.json();
            console.log('Respuesta del login facial:', data);
            
            if (data.access_token) {
                onLoginSuccess(data.access_token, {
                    username: data.username,
                    email: data.email
                });
            } else {
                throw new Error('No se recibió token en la respuesta');
            }
        } catch (err) {
            console.error('Error en el login facial:', err);
            setError(err.message || 'Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isCapturing && videoRef.current && isVideoReady) {
            const checkFrame = () => {
                if (checkCaptureConditions(videoRef.current)) {
                    if (!stabilityTimerRef.current) {
                        stabilityTimerRef.current = setTimeout(() => {
                            if (checkCaptureConditions(videoRef.current)) {
                                capturePhoto();
                            }
                            stabilityTimerRef.current = null;
                        }, 2000);
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
    }, [isCapturing, isVideoReady, checkCaptureConditions, capturePhoto]);

    useEffect(() => {
        return () => {
            handleStopCapture();
        };
    }, [handleStopCapture]);

    // Limpiar localStorage al montar el componente
    useEffect(() => {
        localStorage.removeItem('faceLoginPhoto');
        return () => {
            localStorage.removeItem('faceLoginPhoto');
        };
    }, []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Inicio de Sesión Facial</h3>
            
            <form onSubmit={handleLogin} className="mb-6">
                <div className="flex gap-2">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Correo electrónico"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Enviar
                    </button>
                </div>
            </form>
            
            {sendingMessage && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-600">{sendingMessage}</p>
                </div>
            )}
            
            {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-600">{successMessage}</p>
                </div>
            )}
            
            {photoTaken ? (
                <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-sm text-green-600 text-center">¡Foto tomada exitosamente!</p>
                    </div>
                    <div className="flex justify-center">
                        <button
                            onClick={handleRetry}
                            className="px-4 py-2 rounded-md font-medium bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">Por favor, coloca tu rostro frente a la cámara:</p>
                        <p className="text-xs text-gray-500">La foto se tomará automáticamente cuando estés listo</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600">{error}</p>
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
                </>
            )}
        </div>
    );
};

export default FaceLogin; 