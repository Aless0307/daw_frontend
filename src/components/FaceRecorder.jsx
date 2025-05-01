import React, { useState, useRef, useEffect } from 'react';
import './FaceRecorder.css';
import { useNavigate } from 'react-router-dom';
// Componente FaceRecorder para registrar fotos de rostros
const FaceRecorder = ({ onPhotoComplete, onStartCapture, onStopCapture }) => {
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
    const [isRegistering, setIsRegistering] = useState(true); // Estado para indicar si se está registrando
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


                const raw = sessionStorage.getItem('recordedAudio');
                if (raw) {
                    const data = JSON.parse(raw);
                    //Todos los datos almacenados en sessionStorage
                    //impresión de todo lo guardado en sessionStorage
                    console.log("\n%c========== DATOS ALMACENADOS EN SESSION STORAGE ==========", "color: #FF9800; font-weight: bold; font-size: 14px;");
                    console.log("%cNombre de usuario: %c" + sessionStorage.getItem('username'), "color: #FF9800; font-weight: bold", "color: #000; font-weight: normal");
                    console.log("%cEmail: %c" + sessionStorage.getItem('email'), "color: #FF9800; font-weight: bold", "color: #000; font-weight: normal");
                    console.log("%cContraseña: %c" + sessionStorage.getItem('password'), "color: #FF9800; font-weight: bold", "color: #000; font-weight: normal");
                    console.log("%cFoto capturada: %c" + blobUrl, "color: #FF9800; font-weight: bold", "color: #000; font-weight: normal");
                    console.log("%cAudio grabado: %c" + data.url, "color: #FF9800; font-weight: bold", "color: #000; font-weight: normal");
                    console.log("%c========================================================", "color: #FF9800; font-weight: bold; font-size: 14px;");
                
                }

                if (isRegistering) {
                    //enviamos todo al backend
                    const formData = new FormData();

                    // Agregar datos de texto
                    formData.append("username", sessionStorage.getItem("username"));
                    formData.append("email", sessionStorage.getItem("email"));
                    formData.append("password", sessionStorage.getItem("password"));

                    // Agregar la foto si existe
                    if (window.capturedPhotoBlob) {
                        const photoFile = new File([window.capturedPhotoBlob], "cara.jpg", { type: "image/jpeg" });
                        formData.append("face_photo", photoFile);
                    } else {
                        console.warn("⚠️ No se encontró la foto en memoria");
                    }

                    // Agregar la grabación si existe
                    if (window.recordedAudioBlob) {
                        const audioFile = new File([window.recordedAudioBlob], "voz.wav", { type: "audio/wav" });
                        formData.append("voice_recording", audioFile);
                    } else {
                        console.warn("⚠️ No se encontró el audio en memoria");
                    }

                    fetch("http://localhost:8003/auth/register", {
                        method: "POST",
                        body: formData
                    })
                    .then(async response => {
                        const data = await response.json();
                        sessionStorage.clear();
                        if (!response.ok) {
                            // Mostrar el error completo si es un array o un objeto
                            let errorMsg = '';
                            if (Array.isArray(data.detail)) {
                                errorMsg = data.detail.map(e => e.msg || JSON.stringify(e)).join(' | ');
                            } else if (typeof data.detail === 'object') {
                                errorMsg = JSON.stringify(data.detail);
                            } else {
                                errorMsg = data.detail || JSON.stringify(data);
                            }
                            setError(errorMsg);
                            console.error("❌ Error al registrar:", errorMsg);
                            throw new Error(errorMsg);
                        }
                    
                        console.log("✅ Registro exitoso:", data);
                        window.capturedPhotoBlob = null;
                        window.recordedAudioBlob = null;
                        sessionStorage.clear(); // Limpiar sessionStorage después del registro
                        sessionStorage.setItem('registered', 'true');
                        navigate('/AccessibleLogin');

                    })
                    .catch(error => {
                        console.error("❌ Error al registrar:", error);
                    })
                    .finally(() => {
                        setIsRegistering(false);
                    });
                    
                }
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
        <div className="bg-gray-800/80 backdrop-blur-xl rounded-xl border border-pink-500/20 p-6 shadow-2xl glow-card">
          <h3 className="text-lg font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-yellow-400 to-green-500 mb-4">
            Registro Facial
          </h3>
          
          <div className="mb-4 text-center">
            <p className="text-md text-gray-100">Por favor, coloca tu rostro frente a la cámara:</p>
            <p className="text-sm text-cyan-400 mt-2">La foto se tomará automáticamente cuando estés listo</p>
          </div>
    
          {error && (
            <div className="mb-4 p-4 bg-gray-900/60 rounded-lg border border-red-500/30">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
    
          {photoSuccess && !isCapturing && (
            <div className="mb-4 p-4 bg-gray-900/60 rounded-lg border border-green-500/30">
              <p className="text-sm text-green-400">¡Foto capturada con éxito! Ya puedes enviar el formulario.</p>
            </div>
          )}
    
          <div className="mb-6">
            {isCapturing && (
              <div className="relative">
                <div className="p-1 bg-gray-900/60 rounded-lg border border-cyan-500/30">
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
                </div>
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded-lg border border-yellow-500/20 shadow-lg">
                  <div className="flex items-center">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2 shadow-lg shadow-green-500/50"></span>
                    <p className="text-xs text-yellow-400 neon-text-gold">Estabilidad: {Math.round((1 - stability/5) * 100)}%</p>
                  </div>
                  <div className="flex items-center mt-1">
                    <span className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse mr-2 shadow-lg shadow-cyan-400/50"></span>
                    <p className="text-xs text-yellow-400 neon-text-gold">Luminosidad: {Math.round(lightLevel)}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
    
          <div className="flex items-center justify-center">
            <button
              id="iniciarCamaraBtn"
              onClick={isCapturing ? handleStopCapture : handleStartCapture}
              className={`px-4 py-2 rounded-full font-medium flex items-center shadow-lg transition-all duration-300 hover:-translate-y-1 ${
                isCapturing
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30 hover:shadow-red-500/50'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-blue-500/30 hover:shadow-blue-500/50'
              }`}
              type="button"
              data-testid="camera-button"
            >
              {isCapturing ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm8-8a8 8 0 11-16 0 8 8 0 0116 0zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                  Detener Cámara
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Iniciar Cámara
                </>
              )}
            </button>
          </div>
          
          {photoSuccess && !isCapturing && (
            <div className="mt-4 text-center">
              <span className="text-lg tracking-widest font-mono golden-text font-bold">
                ¡Registro completado!
              </span>
            </div>
          )}
        </div>
      );
};

export default FaceRecorder;