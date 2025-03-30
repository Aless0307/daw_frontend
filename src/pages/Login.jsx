import { useState } from 'react';

export default function Login() {
    const [authMethod, setAuthMethod] = useState('facial'); // 'facial' o 'vocal'

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
            <div className="relative bg-white/90 backdrop-blur-lg p-10 rounded-2xl shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.02]">
                {/* Elementos decorativos */}
                <div className="absolute -top-4 -left-4 w-20 h-20 bg-blue-500 rounded-full opacity-20"></div>
                <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-purple-500 rounded-full opacity-20"></div>
                
                <div className="relative z-10">
                    <h1 className="text-4xl font-bold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                        Bienvenido
                    </h1>
                    <p className="text-center text-gray-600 mb-8">
                        Inicia sesión de forma segura y accesible
                    </p>
                    
                    {/* Selector de método de autenticación */}
                    <div className="mb-8">
                        <label className="block text-lg font-medium text-gray-700 mb-3">
                            Elige tu método de autenticación
                        </label>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setAuthMethod('facial')}
                                className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                                    authMethod === 'facial'
                                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
                                }`}
                                aria-label="Iniciar sesión con reconocimiento facial"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl mb-2">👤</span>
                                    <span className="text-sm">Facial</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setAuthMethod('vocal')}
                                className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                                    authMethod === 'vocal'
                                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
                                }`}
                                aria-label="Iniciar sesión con reconocimiento vocal"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl mb-2">🎤</span>
                                    <span className="text-sm">Vocal</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Área de autenticación */}
                    <div className="space-y-6">
                        {authMethod === 'facial' ? (
                            <div className="text-center">
                                <div className="relative w-48 h-48 mx-auto mb-6">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full opacity-20 animate-pulse"></div>
                                    <div className="relative w-full h-full bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-blue-500">
                                        <span className="text-5xl">👤</span>
                                    </div>
                                </div>
                                <button
                                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                                    aria-label="Iniciar reconocimiento facial"
                                >
                                    Iniciar Reconocimiento Facial
                                </button>
                                <p className="mt-4 text-sm text-gray-600">
                                    Por favor, mire directamente a la cámara
                                </p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="relative w-48 h-48 mx-auto mb-6">
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full opacity-20 animate-pulse"></div>
                                    <div className="relative w-full h-full bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-purple-500">
                                        <span className="text-5xl">🎤</span>
                                    </div>
                                </div>
                                <button
                                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                                    aria-label="Iniciar reconocimiento vocal"
                                >
                                    Iniciar Reconocimiento Vocal
                                </button>
                                <p className="mt-4 text-sm text-gray-600">
                                    Por favor, repita la frase que escuchará
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Información de accesibilidad */}
                    <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                        <h2 className="text-lg font-medium text-blue-800 mb-3 flex items-center">
                            <span className="mr-2">♿</span>
                            Características de Accesibilidad
                        </h2>
                        <ul className="text-sm text-blue-700 space-y-2">
                            <li className="flex items-center">
                                <span className="mr-2">✓</span>
                                Compatible con lectores de pantalla
                            </li>
                            <li className="flex items-center">
                                <span className="mr-2">✓</span>
                                Alto contraste para mejor visibilidad
                            </li>
                            <li className="flex items-center">
                                <span className="mr-2">✓</span>
                                Navegación por teclado
                            </li>
                            <li className="flex items-center">
                                <span className="mr-2">✓</span>
                                Mensajes de retroalimentación claros
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
} 