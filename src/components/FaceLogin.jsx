import React, { useState, useRef, useEffect } from 'react';
import './FaceRecorder.css';
import { useNavigate } from 'react-router-dom';
import { config } from '../config';
// Componente FaceRecorder para registrar fotos de rostros
const FaceLogin = ({ onPhotoComplete, onStartCapture, onStopCapture, onLoginSuccess }) => {
    const navigate = useNavigate(); // Hook para navegar entre rutas
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
    const [isLogging, setisLogging] = useState(true); // Estado para indicar si se está registrando
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
                if (!blob) {
                    setError('No se pudo capturar la foto');
                    return;
                }
                window.capturedPhotoBlob = blob;
                setPhotoBlob(blob);
                setPhotoSuccess(true);
                if (onPhotoComplete) {
                    onPhotoComplete(blob);
                }
                const now = new Date();
                // Convertir blob a una URL temporal y guardarla en sessionStorage
                const blobUrl = URL.createObjectURL(blob);
                sessionStorage.setItem('capturedPhoto', blobUrl);

                // Registrar datos sobre la foto capturada
                const imageSizeKB = (blob.size / 1024).toFixed(2);
                console.log("\n%c========== DATOS DE CAPTURA FACIAL ==========", "color: #2196F3; font-weight: bold; font-size: 14px;");
                console.log("%cFecha y hora: %c" + now.toLocaleString(), "color: #4CAF50; font-weight: bold", "color: #000; font-weight: normal");
                console.log("%cTamaño: %c" + imageSizeKB + " KB", "color: #4CAF50; font-weight: bold", "color: #000; font-weight: normal");
                console.log("%cTipo: %c" + blob.type, "color: #4CAF50; font-weight: bold", "color: #000; font-weight: normal");
                console.log("%cResolución: %c" + canvas.width + "x" + canvas.height + " px", "color: #4CAF50; font-weight: bold", "color: #000; font-weight: normal");
                console.log("%cEstabilidad: %c" + Math.round((1 - stability/5) * 100) + "%", "color: #4CAF50; font-weight: bold", "color: #000; font-weight: normal");
                console.log("%cLuminosidad: %c" + Math.round(lightLevel) + "%", "color: #4CAF50; font-weight: bold", "color: #000; font-weight: normal");
                console.log("%cUbicación temporal: %c" + blobUrl, "color: #4CAF50; font-weight: bold", "color: #000; font-weight: normal");
                console.log("%c===============================================", "color: #2196F3; font-weight: bold; font-size: 14px;");

                if (isLogging) {
                    // LOGIN FACIAL
                    const formData = new FormData();
                        // Obtener email desde sessionStorage o pedirlo
                        const email = sessionStorage.getItem('correovocal') || '';
                    if (!email) {
                        setisLogging(false);
                        return;
                    }
                    formData.append('email', email);
                    // Adjuntar la foto
                    if (window.capturedPhotoBlob) {
                        const photoFile = new File([window.capturedPhotoBlob], 'cara.jpg', { type: 'image/jpeg' });
                        formData.append('face_photo', photoFile);
                    } else {
                        setError('No se encontró la foto capturada.');
                        setisLogging(false);
                        return;
                    }
                    loginWithFace(formData, email);
                }
            }, 'image/jpeg', 0.95);
        } catch (error) {
            console.error('Error al capturar la foto:', error);
            setError('Error al capturar la foto');
        }
    };

    // Función asíncrona para manejar el login facial
    async function loginWithFace(formData, email) {
        try {
            console.log('[FaceLogin] Enviando petición a:', `${config.API_URL}/auth/login_face`);
            for (let pair of formData.entries()) {
                if (pair[0] === 'face_photo' && pair[1] instanceof File) {
                    console.log(`[FaceLogin] FormData: ${pair[0]} = Archivo: nombre=${pair[1].name}, tamaño=${pair[1].size} bytes, tipo=${pair[1].type}`);
                } else {
                    console.log(`[FaceLogin] FormData: ${pair[0]} = ${pair[1]}`);
                }
            }
            const response = await fetch(`${config.API_URL}/auth/login_face`, {
                method: 'POST',
                body: formData
            });
            console.log('[FaceLogin] Código de respuesta HTTP:', response.status);
            let data = null;
            try {
                data = await response.json();
                } catch(jsonErr) {
                console.error('[FaceLogin] Error al parsear el JSON de la respuesta:', jsonErr);
            }
            if (!response.ok) {
                let errorMsg = '';
                if (data && typeof data.detail === 'string') errorMsg = data.detail;
                else if (data && typeof data.msg === 'string') errorMsg = data.msg;
                else if (data && Array.isArray(data) && data.length && typeof data[0].msg === 'string') errorMsg = data[0].msg;
                else errorMsg = JSON.stringify(data);
                setError(errorMsg);
                setisLogging(false);
                console.error('[FaceLogin] Error recibido del backend:', errorMsg);
                return;
            }
            if (!data || !data.access_token) {
                setError('No se recibió token en la respuesta');
                setisLogging(false);
                console.error('[FaceLogin] No se recibió access_token en la respuesta:', data);
                return;
            }
            localStorage.clear();
            sessionStorage.clear()

            
            sessionStorage.setItem('access_token', data.access_token);
            sessionStorage.setItem('email', data.email);
            if (typeof window.onLoginSuccess === 'function') {
                window.onLoginSuccess(data.access_token, {
                    username: data.username || email,
                    email: data.email || email
                });
            } else if (typeof onLoginSuccess === 'function') {
                onLoginSuccess(data.access_token, {
                    username: data.username || email,
                    email: data.email || email
                });
            } else {
                // Fallback: guardar token y navegar
                sessionStorage.setItem('access_token', data.access_token);
                window.location.href = '/home';
            }
            setisLogging(false);
        } catch (error) {
            setError('Error al conectar con el servidor');
            setisLogging(false);
            console.error('[FaceLogin] Error de red o fetch:', error);
        }
    }

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

    // Iniciar la cámara automáticamente al montar el componente
    useEffect(() => {
        if (!isCapturing) {
            handleStartCapture();
        }
        // eslint-disable-next-line
    }, []);

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
                    id="iniciarCamaraBtn"
                    onClick={isCapturing ? handleStopCapture : handleStartCapture}
                    className={`px-4 py-2 rounded-md font-medium ${
                        isCapturing
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    type="button"
                    data-testid="camera-button"
                >
                    {isCapturing ? 'Detener Cámara' : 'Iniciar Cámara'}
                </button>
            </div>
        </div>
    );
};

export default FaceLogin;