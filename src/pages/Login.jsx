import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VoiceRecorder from '../components/VoiceRecorder';
import VoiceLogin from '../components/VoiceLogin';
import FaceRecorder from '../components/FaceRecorder';
import FaceLogin from '../components/FaceLogin';
import BraillePassword from '../components/BraillePassword';
import { config } from '../config';
import { playPredefinedMessage } from '../services/audioService';

const Login = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [showVoiceLogin, setShowVoiceLogin] = useState(false);
    const [showFaceLogin, setShowFaceLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [photoBlob, setPhotoBlob] = useState(null);
    const [showBrailleInput, setShowBrailleInput] = useState(false);
    const [registrationStep, setRegistrationStep] = useState(0); // 0: Inicial, 1: Usuario, 2: Email, 3: Contraseña, 4: Voz, 5: Foto
    const [isVoiceRegistrationComplete, setIsVoiceRegistrationComplete] = useState(false);
    const [isFaceRegistrationComplete, setIsFaceRegistrationComplete] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();
    const audioRef = useRef(null);

    // Estado para el manejo de sonidos y voz
    const [voiceUserName, setVoiceUserName] = useState('');
    const [voiceEmail, setVoiceEmail] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    // Inicializar reconocimiento de voz
    useEffect(() => {
        if (isRegistering && registrationStep > 0) {
            // Verificar si el navegador soporta reconocimiento de voz
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                setError('El reconocimiento de voz no es compatible con este navegador.');
                return;
            }

            // Crear instancia de reconocimiento de voz
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.lang = 'es-ES';
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = false;

            // Configurar eventos
            recognitionRef.current.onresult = handleSpeechResult;
            recognitionRef.current.onerror = (event) => {
                console.error('Error en reconocimiento de voz:', event.error);
                setError(`Error en reconocimiento: ${event.error}`);
                setIsListening(false);
            };
            recognitionRef.current.onend = () => {
                if (isListening && registrationStep < 3) { // No reiniciar escucha para la contraseña
                    recognitionRef.current.start();
                }
            };

            // Guiar al usuario según el paso actual
            if (registrationStep === 1) {
                playAudio('askUserName');
                startListening();
            } else if (registrationStep === 2) {
                playAudio('askEmail');
                startListening();
            } else if (registrationStep === 3) {
                setShowBrailleInput(true);
            }
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [isRegistering, registrationStep]);

    // Manejar el cambio de isRegistering
    useEffect(() => {
        if (isRegistering) {
            console.log("Iniciando proceso de registro por voz");
            
            // Restablecer estados
            setVoiceUserName('');
            setVoiceEmail('');
            setPassword('');
            setAudioBlob(null);
            setPhotoBlob(null);
            
            // Si estamos en modo registro, iniciar el proceso guiado inmediatamente
            setRegistrationStep(1);
            
            // Iniciar secuencia de registro con audios
            const startRegistrationSequence = async () => {
                try {
                    // Dar un breve tiempo para que la interfaz se actualice
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Reproducir audio de bienvenida al registro
                    console.log("Reproduciendo audio de registro");
                    await playAudioAndWait('register');
                    
                    // Luego reproducir la guía de voz
                    console.log("Reproduciendo guía de voz");
                    await playAudioAndWait('registerVoiceGuide');
                    
                    // Después iniciar el primer paso
                    console.log("Iniciando paso 1: nombre de usuario");
                    await playAudioAndWait('askUserName');
                    
                    // Iniciar reconocimiento de voz
                    startListening();
                } catch (error) {
                    console.error("Error en la secuencia de registro:", error);
                    setError("Error al iniciar el proceso de registro. Por favor, intente nuevamente.");
                }
            };
            
            startRegistrationSequence();
        } else {
            // Si no estamos en modo registro, reiniciar todo
            setRegistrationStep(0);
            setIsVoiceRegistrationComplete(false);
            setIsFaceRegistrationComplete(false);
            setShowBrailleInput(false);
            setVoiceUserName('');
            setVoiceEmail('');
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        }
    }, [isRegistering]);

    // Función para manejar los resultados del reconocimiento de voz
    const handleSpeechResult = async (event) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.trim().toLowerCase();
        
        console.log('Comando reconocido:', transcript);
        
        try {
            if (registrationStep === 1) {
                // Capturar el nombre de usuario
                setVoiceUserName(transcript);
                setUsername(transcript);
                await playAudioAndWait('userNameConfirmed');
                setRegistrationStep(2);
                await playAudioAndWait('askEmail');
                startListening();
            } else if (registrationStep === 2) {
                // Capturar el correo electrónico
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (emailRegex.test(transcript)) {
                    setVoiceEmail(transcript);
                    setEmail(transcript);
                    await playAudioAndWait('emailConfirmed');
                    await playAudioAndWait('passwordPrompt');
                    setRegistrationStep(3);
                    stopListening();
                    setTimeout(() => {
                        setShowBrailleInput(true);
                    }, 500);
                } else {
                    await playAudioAndWait('invalidEmail');
                }
            }
        } catch (error) {
            console.error("Error al procesar comando de voz:", error);
            setError("Error al procesar el comando. Por favor, intente nuevamente.");
        }
    };

    // Reproducir archivos de audio
    const playAudio = (audioName) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        
        try {
            console.log(`Intentando reproducir audio: ${audioName}`);
            const audioPath = `${window.location.origin}/audio/${audioName}.mp3`;
            console.log(`Ruta completa del audio: ${audioPath}`);
            
            const audio = new Audio(audioPath);
            
            audio.addEventListener('error', (e) => {
                console.error(`Error al cargar el audio ${audioName}:`, e);
                if (e.target.error) {
                    console.error('Código de error:', e.target.error.code);
                    console.error('Mensaje de error:', e.target.error.message);
                }
                setError(`No se pudo reproducir el audio ${audioName}. Verifique su conexión o permisos.`);
            });
            
            audio.addEventListener('canplaythrough', () => {
                console.log(`Audio ${audioName} listo para reproducir`);
            });
            
            audioRef.current = audio;
            
            audio.play().catch(error => {
                console.error(`Error al reproducir audio ${audioName}:`, error);
                setError(`Error al reproducir audio: ${error.message}`);
            });
        } catch (error) {
            console.error(`Error general al manejar audio ${audioName}:`, error);
            setError(`Error al manejar audio: ${error.message}`);
        }
    };

    // Función para reproducir audio y esperar a que termine
    const playAudioAndWait = (audioName) => {
        return new Promise((resolve) => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            
            try {
                console.log(`Reproduciendo audio (con espera): ${audioName}`);
                const audioPath = `${window.location.origin}/audio/${audioName}.mp3`;
                
                const audio = new Audio(audioPath);
                
                audio.addEventListener('error', (e) => {
                    console.error(`Error al cargar el audio ${audioName}:`, e);
                    if (e.target.error) {
                        console.error('Código de error:', e.target.error.code);
                    }
                    setError(`No se pudo reproducir el audio ${audioName}`);
                    resolve();
                });
                
                audio.addEventListener('ended', () => {
                    console.log(`Audio ${audioName} terminado`);
                    resolve();
                });
                
                audioRef.current = audio;
                
                audio.play().catch(error => {
                    console.error(`Error al reproducir audio ${audioName}:`, error);
                    setError(`Error al reproducir audio: ${error.message}`);
                    resolve();
                });
            } catch (error) {
                console.error(`Error general al manejar audio ${audioName}:`, error);
                setError(`Error al manejar audio: ${error.message}`);
                resolve();
            }
        });
    };

    // Iniciar la escucha de voz
    const startListening = () => {
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (error) {
            console.error('Error al iniciar reconocimiento:', error);
            setError(`Error al iniciar reconocimiento: ${error.message}`);
        }
    };

    // Detener la escucha de voz
    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (isRegistering) {
            if (!username || !email || !password) {
                setError('Por favor completa todos los campos');
                return;
            }

            const formData = new FormData();
            formData.append('username', username);
            formData.append('email', email);
            formData.append('password', password);

            if(audioBlob){
                formData.append('voice_recording', audioBlob, 'voice.wav');
            }
            
            if (photoBlob) {
                formData.append('face_photo', photoBlob, 'face.jpg');
            }

            console.log('Datos enviados al backend:', {
                username,
                email,
                password,
                hasVoice: !!audioBlob,
                hasPhoto: !!photoBlob
            });

            try {
                const response = await fetch(`${config.API_URL}/auth/register`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Error en el registro');
                }

                const data = await response.json();
                console.log('Registro exitoso:', data);
                setSuccess('Registro exitoso. Por favor, inicia sesión.');
                setIsRegistering(false);
                setEmail('');
                setPassword('');
                setUsername('');
                setAudioBlob(null);
                setPhotoBlob(null);
                setRegistrationStep(0);
            } catch (err) {
                console.error('Error en el registro:', err);
                setError('Error al conectar con el servidor');
            }
        } else {
            if (!username || !password) {
                setError('Por favor completa todos los campos');
            }

            try {
                const username = email;
                const loginData = new URLSearchParams({username, password });
                console.log('Datos enviados al backend:', {
                    username,
                    password,
                    url: `${config.API_URL}/auth/login`,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });

                const response = await fetch(`${config.API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: loginData
                });

                console.log('Respuesta del servidor:', response);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Error en el inicio de sesión');
                }

                const data = await response.json();
                console.log('Respuesta del login:', data);
                
                if (!data.access_token) {
                    throw new Error('No se recibió token en la respuesta');
                }

                const loginDataToSend = {
                    token: data.access_token,
                    username: data.username || username,
                    email: data.email || email
                };

                console.log('Datos de login a enviar:', loginDataToSend);
                login(loginDataToSend);
                navigate('/home');
            } catch (err) {
                console.error('Error en el inicio de sesión:', err);
                setError('Error al conectar con el servidor');
            }
        }
    };

    const handleVoiceRecordingComplete = (audioBlob) => {
        setAudioBlob(audioBlob);
        setIsVoiceRegistrationComplete(true);
        
        // Si ya tenemos la voz y la foto, podemos enviar el formulario
        if (isFaceRegistrationComplete) {
            handleSubmit({preventDefault: () => {}});
        } else {
            setRegistrationStep(5); // Pasar al registro facial
        }
    };

    const handleStartRecording = () => {
        setIsRecording(true);
    };

    const handleStopRecording = () => {
        setIsRecording(false);
    };

    const handleVoiceLoginSuccess = (token, user) => {
        console.log('Login con voz exitoso:', token, user);
        
        if (!token || !user) {
            setError('Datos de autenticación incompletos');
            console.error('Error: token o user undefined', { token, user });
            return;
        }
        
        login({
            token: token,
            username: user.username,
            email: user.email
        });
        navigate('/home');
    };

    const handlePhotoComplete = (blob) => {
        setPhotoBlob(blob);
        setIsFaceRegistrationComplete(true);
        
        // Si ya tenemos la voz y la foto, podemos enviar el formulario
        if (isVoiceRegistrationComplete) {
            handleSubmit({preventDefault: () => {}});
        }
    };

    const handleStartCapture = () => {
        setIsCapturing(true);
    };

    const handleStopCapture = () => {
        setIsCapturing(false);
    };

    const handleBraillePasswordComplete = (braillePassword) => {
        console.log('Contraseña braille completada');
        setPassword(braillePassword);
        setShowBrailleInput(false);
        // Pasar al siguiente paso después de la contraseña
        setRegistrationStep(4); // Registro de voz
    };

    const toggleBrailleInput = () => {
        setShowBrailleInput(!showBrailleInput);
    };

    // Renderizar el paso actual del registro
    const renderRegistrationStep = () => {
        switch (registrationStep) {
            case 0:
    return (
                    <>
                        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                            <div className="rounded-md shadow-sm -space-y-px">
                                {isRegistering && (
                                    <div>
                                        <label htmlFor="username" className="sr-only">
                                            Nombre de usuario
                                        </label>
                                        <input
                                            id="username"
                                            name="username"
                                            type="text"
                                            required
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                            placeholder="Nombre de usuario"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="email" className="sr-only">
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${
                                            isRegistering ? 'rounded-none' : 'rounded-t-md'
                                        } focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                        placeholder="Correo electrónico"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="sr-only">
                                        Contraseña
                                    </label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                        placeholder="Contraseña"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="text-red-500 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="text-green-500 text-sm text-center">
                                    {success}
                                </div>
                            )}

                            <div>
                                <button
                                    type="submit"
                                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    {isRegistering ? 'Registrarse' : 'Iniciar sesión'}
                                </button>
                            </div>

                            {isRegistering && (
                                <div className="mt-3">
                                    <button
                                        type="button"
                                        onClick={toggleBrailleInput}
                                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                                    >
                                        {password ? 'Cambiar contraseña (Braille)' : 'Crear contraseña con Braille'}
                                    </button>
                                </div>
                            )}
                        </form>

                        {isRegistering && (
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                                <h3 className="text-md font-medium text-blue-800 mb-2">Registro guiado por voz</h3>
                                <p className="text-sm text-blue-700 mb-3">
                                    Inicia el proceso de registro guiado por voz, que te llevará paso a paso para crear tu cuenta
                                </p>
                                <button
                                    onClick={async () => {
                                        setRegistrationStep(1);
                                        try {
                                            await playAudioAndWait('registerVoiceGuide');
                                            await playAudioAndWait('askUserName');
                                            startListening();
                                        } catch (error) {
                                            console.error("Error al iniciar registro por voz:", error);
                                            setError("Error al iniciar el proceso. Por favor, intente nuevamente.");
                                        }
                                    }}
                                    className="w-full mt-2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                >
                                    Iniciar registro por voz
                                </button>
                            </div>
                        )}
                    </>
                );
            case 1: // Nombre de usuario
                return (
                    <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                        <h3 className="text-lg font-medium text-blue-800 mb-2">Paso 1: Nombre de usuario</h3>
                        <p className="text-sm text-blue-700 mb-4">
                            Por favor, di tu nombre de usuario cuando escuches el tono
                            {isListening && <span className="ml-2 animate-pulse">🎤 Escuchando...</span>}
                        </p>
                        {!isListening && (
                            <button
                                onClick={() => {
                                    playAudio('askUserName');
                                    startListening();
                                }}
                                className="w-full mt-2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                            >
                                Iniciar escucha
                            </button>
                        )}
                        {voiceUserName && (
                            <div className="mt-4 p-3 bg-white rounded shadow-sm">
                                <p className="font-medium">Nombre capturado: {voiceUserName}</p>
                                
                                <div className="mt-3 flex space-x-3">
                                    <button
                                        onClick={async () => {
                                            setRegistrationStep(2);
                                            try {
                                                await playAudioAndWait('askEmail');
                                                startListening();
                                            } catch (error) {
                                                console.error("Error al pasar al paso 2:", error);
                                                setError("Error al iniciar el paso 2. Por favor, intente nuevamente.");
                                            }
                                        }}
                                        className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                                    >
                                        Continuar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setVoiceUserName('');
                                            playAudio('askUserName');
                                            startListening();
                                        }}
                                        className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 2: // Correo electrónico
                return (
                    <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                        <h3 className="text-lg font-medium text-blue-800 mb-2">Paso 2: Correo electrónico</h3>
                        <p className="text-sm text-blue-700 mb-4">
                            Por favor, di tu correo electrónico completo cuando escuches el tono
                            {isListening && <span className="ml-2 animate-pulse">🎤 Escuchando...</span>}
                        </p>
                        {!isListening && (
                            <button
                                onClick={() => {
                                    playAudio('askEmail');
                                    startListening();
                                }}
                                className="w-full mt-2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                            >
                                Iniciar escucha
                            </button>
                        )}
                        {voiceEmail && (
                            <div className="mt-4 p-3 bg-white rounded shadow-sm">
                                <p className="font-medium">Correo capturado: {voiceEmail}</p>
                                
                                <div className="mt-3 flex space-x-3">
                                    <button
                                        onClick={async () => {
                                            setRegistrationStep(3);
                                            try {
                                                await playAudioAndWait('emailConfirmed');
                                                await playAudioAndWait('passwordPrompt');
                                                setTimeout(() => {
                                                    setShowBrailleInput(true);
                                                }, 500);
                                            } catch (error) {
                                                console.error("Error al pasar al paso 3:", error);
                                                setError("Error al iniciar el paso 3. Por favor, intente nuevamente.");
                                            }
                                        }}
                                        className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                                    >
                                        Continuar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setVoiceEmail('');
                                            playAudio('askEmail');
                                            startListening();
                                        }}
                                        className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 3: // Contraseña braille
                return (
                    <div className="mt-8">
                        <BraillePassword onPasswordComplete={handleBraillePasswordComplete} />
                    </div>
                );
            case 4: // Grabación de voz
                return (
                    <div className="mt-8">
                        <div className="text-center mb-4">
                            <h3 className="text-lg font-medium text-blue-800 mb-2">Paso 4: Grabación de voz</h3>
                            <p className="text-sm text-gray-600">Para poder iniciar sesión con tu voz en el futuro</p>
                        </div>
                        <VoiceRecorder
                            onRecordingComplete={handleVoiceRecordingComplete}
                            onStartRecording={handleStartRecording}
                            onStopRecording={handleStopRecording}
                        />
                    </div>
                );
            case 5: // Captura facial
                return (
                    <div className="mt-8">
                        <div className="text-center mb-4">
                            <h3 className="text-lg font-medium text-blue-800 mb-2">Paso 5: Registro facial</h3>
                            <p className="text-sm text-gray-600">Para poder iniciar sesión con reconocimiento facial</p>
                        </div>
                        <FaceRecorder
                            onPhotoComplete={handlePhotoComplete}
                            onStartCapture={handleStartCapture}
                            onStopCapture={handleStopCapture}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        {isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        {isRegistering ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}{' '}
                        <button
                            onClick={() => {
                                // Si estamos cambiando a modo registro
                                if (!isRegistering) {
                                    console.log("Usuario ha hecho clic en Registrarse");
                                    // Limpiar estados previos
                                    setShowVoiceLogin(false);
                                    setShowFaceLogin(false);
                                    setShowBrailleInput(false);
                                    setEmail('');
                                    setPassword('');
                                    setUsername('');
                                    // Establecer modo registro - esto disparará el useEffect
                                    setIsRegistering(true);
                                } else {
                                    // Si estamos volviendo a login
                                    setIsRegistering(false);
                                    setShowVoiceLogin(false);
                                    setShowFaceLogin(false);
                                    setShowBrailleInput(false);
                                }
                            }}
                            className="font-medium text-indigo-600 hover:text-indigo-500"
                        >
                            {isRegistering ? 'Iniciar sesión' : 'Registrarse'}
                        </button>
                    </p>
                </div>

                {!showVoiceLogin && !showFaceLogin ? (
                    <>
                        {isRegistering ? (
                            renderRegistrationStep()
                        ) : (
                            <>
                                {renderRegistrationStep()}
                            <div className="mt-6">
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-white text-gray-500">O</span>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <button
                                        onClick={() => setShowVoiceLogin(true)}
                                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                    >
                                        Iniciar sesión con voz
                                    </button>
                                </div>
                                <div className="mt-4">
                                    <button
                                        onClick={() => setShowFaceLogin(true)}
                                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Iniciar sesión con reconocimiento facial
                                    </button>
                                </div>
                            </div>
                            </>
                        )}
                    </>
                ) : showFaceLogin ? (
                    <div className="mt-8">
                        <FaceLogin onLoginSuccess={handleVoiceLoginSuccess} />
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => {
                                    setShowFaceLogin(false);
                                    setShowVoiceLogin(false);
                                }}
                                className="text-sm text-indigo-600 hover:text-indigo-500"
                            >
                                Volver al login normal
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-8">
                        <VoiceLogin onLoginSuccess={handleVoiceLoginSuccess} />
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => setShowVoiceLogin(false)}
                                className="text-sm text-indigo-600 hover:text-indigo-500"
                            >
                                Volver al login normal
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-red-500 text-sm text-center mt-4">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login; 