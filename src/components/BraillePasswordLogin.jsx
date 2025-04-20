import React, { useState, useEffect, useRef } from 'react';
import { config } from '../config';
import './BraillePassword.css';
import { speakWithPolly } from '../services/pollyService';
import { playBeep, playPredefinedMessage } from '../services/audioService';

// Función para convertir un array de puntos a su descripción verbal
const getDotsDescription = (dots) => {
    if (!dots || dots.length === 0) return '';
    
    if (dots.length === 1) {
        return `punto ${dots[0]}`;
    } else if (dots.length === 2) {
        return `puntos ${dots[0]} y ${dots[1]}`;
    } else {
        const lastDot = dots[dots.length - 1];
        const initialDots = dots.slice(0, -1).join(', ');
        return `puntos ${initialDots} y ${lastDot}`;
    }
};

const BraillePasswordLogin = ({ onPasswordComplete }) => {
    const [activeDots, setActiveDots] = useState([]);
    const [password, setPassword] = useState('');
    const [displayPassword, setDisplayPassword] = useState('');
    const [listening, setListening] = useState(false);
    const [message, setMessage] = useState('');
    const [currentCharacter, setCurrentCharacter] = useState('');
    const [status, setStatus] = useState('waiting'); // waiting, listening, processing, completed
    // Nuevo estado para almacenar las combinaciones de puntos usadas
    const [dotCombinations, setDotCombinations] = useState([]);
    // Estados para la funcionalidad de edición
    const [editMode, setEditMode] = useState(false); // Modo de edición activado/desactivado
    const [editPosition, setEditPosition] = useState(-1); // Posición que se está editando (base 0)
    const [editStep, setEditStep] = useState('none'); // none, askPosition, editingPosition, confirmEdit
    // Nuevo estado para controlar si ya se reprodujeron las instrucciones de edición
    const [playedEditInstructions, setPlayedEditInstructions] = useState(false);
    // Nuevo estado para controlar si ya se reprodujo el prompt de posición
    const [playedPositionPrompt, setPlayedPositionPrompt] = useState(false);
    
    const audioRef = useRef(null);
    
    // Referencias para almacenar los valores más recientes
    const currentCharRef = useRef('');
    const passwordRef = useRef('');
    const displayPasswordRef = useRef('');
    const dotCombinationsRef = useRef([]);
    // Referencias para la edición
    const editModeRef = useRef(false);
    const editPositionRef = useRef(-1);
    const editStepRef = useRef('none');
    // Referencia para el estado del prompt de posición
    const playedPositionPromptRef = useRef(false);
    
    // Efecto para mantener las referencias actualizadas con los estados
    useEffect(() => {
        currentCharRef.current = currentCharacter;
    }, [currentCharacter]);
    
    useEffect(() => {
        passwordRef.current = password;
    }, [password]);
    
    useEffect(() => {
        displayPasswordRef.current = displayPassword;
    }, [displayPassword]);
    
    useEffect(() => {
        dotCombinationsRef.current = dotCombinations;
    }, [dotCombinations]);
    
    // Comprobar si estamos en modo de edición
    useEffect(() => {
        editModeRef.current = editMode;
    }, [editMode]);
    
    useEffect(() => {
        editPositionRef.current = editPosition;
    }, [editPosition]);
    
    useEffect(() => {
        editStepRef.current = editStep;
    }, [editStep]);

    // Actualizar la referencia del estado del prompt de posición
    useEffect(() => {
        playedPositionPromptRef.current = playedPositionPrompt;
    }, [playedPositionPrompt]);

    // Mapeo de combinaciones braille a caracteres (simplificado)
    const brailleMap = {
        '1': 'a', '12': 'b', '14': 'c', '145': 'd', '15': 'e',
        '124': 'f', '1245': 'g', '125': 'h', '24': 'i', '245': 'j',
        '13': 'k', '123': 'l', '134': 'm', '1345': 'n', '135': 'o',
        '1234': 'p', '12345': 'q', '1235': 'r', '234': 's', '2345': 't',
        '136': 'u', '1236': 'v', '2456': 'w', '1346': 'x', '13456': 'y', '1356': 'z',
        '3456': '#', 'numero_16': '1', 'numero_126': '2', 'numero_146': '3', 'numero_1456': '4', 'numero_156': '5',
        'numero_1246': '6', 'numero_12456': '7', 'numero_1256': '8', 'numero_246': '9', 'numero_2456': '0'
    };

    // Referencia al reconocimiento de voz
    const recognitionRef = useRef(null);

    // Inicializar reconocimiento de voz
    useEffect(() => {
        console.log("====== Inicializando componente BraillePasswordLogin ======");
        // Verificar si el navegador soporta reconocimiento de voz
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setMessage('El reconocimiento de voz no es compatible con este navegador.');
            return;
        }
        
        sessionStorage.setItem('brailleactivado', 'true');
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
            setMessage(`Error en reconocimiento: ${event.error}. Puedes usar los botones en pantalla.`);
            
            // Si es un error no fatal, intentar reiniciar después de un tiempo
            if (event.error !== 'not-allowed' && event.error !== 'service-not-allowed') {
                setTimeout(() => {
                    if (listening) {
                        try {
                            startListening();
                        } catch (e) {
                            console.error('Error al reintentar reconocimiento:', e);
                        }
                    }
                }, 2000);
            } else {
                setListening(false);
            }
        };
        recognitionRef.current.onend = () => {
            if (listening) {
                try {
                    recognitionRef.current.start();
                } catch (error) {
                    console.error('Error al reiniciar reconocimiento:', error);
                    setListening(false);
                    setMessage('Error al reiniciar escucha. Inténtalo manualmente.');
                }
            }
        };

        // Usar setTimeout para dar tiempo a que otros componentes se inicialicen completamente
        // y evitar conflictos con otros reconocimientos de voz
        const timeoutId = setTimeout(() => {
            const initializeBraillePasswordLogin = async () => {
                try {
                    console.log("🚀 Iniciando secuencia de instrucciones de BraillePasswordLogin");
                    
                    // Detener cualquier síntesis de voz en curso
                    window.speechSynthesis.cancel();

                    // Pequeña pausa inicial
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Usar síntesis de voz en lugar de audio pregrabado para evitar errores
                    await speakMessage("Bienvenido al sistema de contraseña Braille. A continuación te explicaré cómo funciona.");
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    await speakMessage("Para crear tu contraseña, debes indicar qué puntos del patrón braille deseas activar. Utiliza los números del 1 al 6 para referirte a las posiciones.");
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    await speakMessage("Di 'siguiente' para confirmar un carácter, 'borrar' para eliminar el último, o 'he terminado' cuando hayas completado tu contraseña.");
                    
                    // Iniciar el reconocimiento de voz
                    setStatus('listening');
                    setMessage('Escuchando comandos braille...');
                    console.log("🎧 Iniciando reconocimiento de voz para comandos braille");
                    startListening();
                } catch (error) {
                    console.error('Error durante la inicialización de BraillePasswordLogin:', error);
                    setMessage('Error en la inicialización. Por favor, intenta hablar ahora.');
                }
            };
            
            initializeBraillePasswordLogin();
        }, 1000); // Esperar 1 segundo antes de iniciar la secuencia

        return () => {
            console.log("⚠️ Limpiando componente BraillePasswordLogin");
            clearTimeout(timeoutId);
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (error) {
                    console.error('Error al detener reconocimiento:', error);
                }
            }
            
            // Limpiar cualquier audio en reproducción
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            
            // Cancelar cualquier síntesis de voz pendiente
            window.speechSynthesis.cancel();
            sessionStorage.removeItem('brailleactivado');
        };
    }, []);

    // Función para hablar un mensaje usando síntesis de voz
    const speakMessage = (text) => {
        return new Promise((resolve) => {
            try {
                // Si hay alguna síntesis en curso, cancelarla
                window.speechSynthesis.cancel();
                
                // Verificar si el navegador está en modo de ahorro de energía 
                // o si la página no está activa
                if (document.hidden) {
                    console.log('Página no visible, omitiendo síntesis de voz');
                    resolve();
                    return;
                }
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'es-ES';
                utterance.rate = 0.9; // Hablar un poco más lento para mayor claridad
                utterance.volume = 1.0; // Volumen máximo
                
                utterance.onend = () => {
                    console.log(`Mensaje completado: ${text}`);
                    resolve();
                };
                
                utterance.onerror = (event) => {
                    console.error('Error en síntesis de voz:', event);
                    // No mostrar error al usuario para evitar interrupciones
                    resolve(); // Resolver la promesa incluso si hay error
                };
                
                // Usar setTimeout para evitar problemas de concurrencia
                setTimeout(() => {
                    try {
                        window.speechSynthesis.speak(utterance);
                    } catch (err) {
                        console.error('Error al iniciar síntesis:', err);
                        resolve();
                    }
                }, 300); // Aumentar el retraso para dar más tiempo al navegador
            } catch (error) {
                console.error('Error general en síntesis de voz:', error);
                resolve(); // Resolver la promesa incluso con errores
            }
        });
    };

    // Función para manejar los resultados del reconocimiento de voz
    const handleSpeechResult = (event) => {
        const last = event.results.length - 1;
        const command = event.results[last][0].transcript.trim().toLowerCase();
        
        console.log('Comando reconocido:', command);
        
        // Primero comprobar si es un comando de edición
        if (handleEditCommands(command)) {
            // Si el comando fue manejado por la lógica de edición, terminar aquí
            return;
        }
        
        // Comprobar si el usuario dice "he terminado"
        if (command.includes('terminado') || command.includes('he terminado') || command.includes('finalizar') || command.includes('fin')) {
            completePassword();
            return;
        }
        
        // Primero procesar el comando para activar puntos y luego comprobar si el usuario dice "siguiente"
        // Verificar si el comando incluye la palabra "número" o "numero"
        const isNumberInput = command.includes('número') || command.includes('numero');
        const hasSiguienteCommand = command.includes('siguiente') || command.includes('confirmar') || command.includes('aceptar') || 
                                    command.includes('ok') || command.includes('añadir') || command.includes('agregar');
        
        // Detectar números individuales expresados como texto primero
        // Esta verificación se mueve hacia arriba para darle prioridad
        if (command.includes('uno') && !command.includes('dos') && !command.includes('tres') && 
            !command.includes('cuatro') && !command.includes('cinco') && !command.includes('seis')) {
            handleNumberCombination([1], isNumberInput);
            return;
        }
        if (command.includes('dos') && !command.includes('uno') && !command.includes('tres') && 
            !command.includes('cuatro') && !command.includes('cinco') && !command.includes('seis')) {
            handleNumberCombination([2], isNumberInput);
            return;
        }
        if (command.includes('tres') && !command.includes('uno') && !command.includes('dos') && 
            !command.includes('cuatro') && !command.includes('cinco') && !command.includes('seis')) {
            handleNumberCombination([3], isNumberInput);
            return;
        }
        if (command.includes('cuatro') && !command.includes('uno') && !command.includes('dos') && 
            !command.includes('tres') && !command.includes('cinco') && !command.includes('seis')) {
            handleNumberCombination([4], isNumberInput);
            return;
        }
        if (command.includes('cinco') && !command.includes('uno') && !command.includes('dos') && 
            !command.includes('tres') && !command.includes('cuatro') && !command.includes('seis')) {
            handleNumberCombination([5], isNumberInput);
            return;
        }
        if (command.includes('seis') && !command.includes('uno') && !command.includes('dos') && 
            !command.includes('tres') && !command.includes('cuatro') && !command.includes('cinco')) {
            handleNumberCombination([6], isNumberInput);
            return;
        }
        
        // Detección mejorada para un solo número (1-6) en el comando
        if (/^[1-6]$/.test(command) || command === "un" || command === "uno") {
            let num = command === "uno" || command === "un" ? 1 : parseInt(command);
            console.log("Número individual detectado:", num);
            handleNumberCombination([num], isNumberInput);
            return;
        }
        
        // Detectar números agrupados sin espacios (como "2456")
        // Solución 1: Buscar secuencias de dígitos
        const groupedNumbers = command.match(/\d{2,}/g);
        if (groupedNumbers && groupedNumbers.length > 0) {
            console.log("Detectada secuencia de dígitos:", groupedNumbers[0]);
            const rawDigits = command.replace(/\D/g, '');
            const digits = rawDigits.split('').map(Number).filter(d => d >= 1 && d <= 6);

            if (digits.length > 0) {
                console.log("Dígitos válidos:", digits);
                
                // Manejar combinación y después ejecutar comando "siguiente" si está presente
                handleNumberCombination(digits, isNumberInput);
                
                if (hasSiguienteCommand) {
                    // Usar un retraso mayor para asegurar que la actualización de estado se complete
                    setTimeout(() => {
                        console.log("Comando de confirmación detectado después de dígitos");
                        console.log("Estado antes de confirmar:", currentCharacter, "Referencia:", currentCharRef.current);
                        confirmCharacter();
                        playBeep();
                    }, 800); // Aumentar el retraso para dar más tiempo a que se actualice el estado
                }
                return;
            }
        }
        
        // Solución 2: Si no hay agrupados, intentar extraer todos los dígitos del comando
        if (!groupedNumbers) {
            const allDigits = command.match(/\d/g);
            if (allDigits && allDigits.length > 0) {
                console.log("Extrayendo todos los dígitos del comando:", allDigits);
                const digits = allDigits.map(d => parseInt(d)).filter(d => d >= 1 && d <= 6);
                if (digits.length > 0) {
                    console.log("Dígitos válidos:", digits);
                    
                    // Manejar combinación y después ejecutar comando "siguiente" si está presente
                    handleNumberCombination(digits, isNumberInput);
                    
                    if (hasSiguienteCommand) {
                        // Usar un retraso mayor para asegurar que la actualización de estado se complete
                        setTimeout(() => {
                            console.log("Comando de confirmación detectado después de dígitos");
                            console.log("Estado antes de confirmar:", currentCharacter, "Referencia:", currentCharRef.current);
                            confirmCharacter();
                        }, 800); // Aumentar el retraso para dar más tiempo a que se actualice el estado
                    }
                    return;
                }
            }
        }
        
        // Normalizar el comando para evitar problemas con espacios y comas
        let normalizedCommand = command
        .replace(/uno/g, '1')
        .replace(/dos/g, '2')
        .replace(/tres/g, '3')
        .replace(/cuatro/g, '4')
        .replace(/cinco/g, '5')
        .replace(/seis/g, '6')
        .replace(/,/g, '')
        .replace(/ /g, '');
      

        // Comprobar si el usuario dice "siguiente" o similar
        if (hasSiguienteCommand) {
            console.log("Comando de confirmación detectado");
            confirmCharacter();
            return;
        }
        
        // Comprobar si el usuario dice "borrar" o similar
        if (command.includes('borrar') || command.includes('eliminar') || command.includes('quitar') || 
            command.includes('suprimir') || command.includes('remover')) {
            console.log("Comando de borrado detectado");
            deleteLastCharacter();
            return;
        }
        
        // Comprobar si el usuario dice "ayuda"
        if (command.includes('ayuda') || command.includes('help') || command.includes('instrucciones')) {
            playAudio('brailleHelp');
            return;
        }
        
        // Comprobar si el usuario dice "reiniciar"
        if (/^[1-6]+$/.test(normalizedCommand)) {
            const digits = normalizedCommand.split('').map(Number);
            console.log("Combinación reconocida:", digits);
            handleNumberCombination(digits, isNumberInput);
        
            if (hasSiguienteCommand) {
                setTimeout(() => {
                    confirmCharacter();
                }, 800);
            }
            return;
        }
        
        
        // Intentar reconocer números del 1 al 6 (con diversos separadores)
        // Esta expresión regular buscará dígitos del 1 al 6, separados por espacios, comas, "y", etc.
        const numberRegex = /\b[1-6]\b/g;
        const numbers = command.match(numberRegex);
        
        if (numbers && numbers.length > 0) {
            console.log("Números separados encontrados:", numbers);
            const uniqueNumbers = [...new Set(numbers.map(n => parseInt(n)))].sort();
            
            // Verificar que todos los números estén entre 1 y 6
            const validNumbers = uniqueNumbers.filter(n => n >= 1 && n <= 6);
            
            if (validNumbers.length > 0) {
                console.log("Números válidos separados:", validNumbers);
                handleNumberCombination(validNumbers, isNumberInput);
                return;
            }
        }
        
    };
    
    // Manejar combinación de números
    const handleNumberCombination = (numbers, isNumberInput = false) => {
        if (numbers.length === 0) return;
        
        console.log("handleNumberCombination - Recibidos:", numbers, "isNumberInput:", isNumberInput);
        
        // Solo permitir números del 1 al 6
        const validNumbers = numbers.filter(num => num >= 1 && num <= 6);
        
        if (validNumbers.length === 0) return;
        
        // Actualizar los puntos activos
        setActiveDots(validNumbers);
        
        // Generar la clave para el mapa braille
        let dotKey = validNumbers.sort().join('');
        console.log("Clave generada:", dotKey);
        
        // Si se mencionó "número", añadir el prefijo
        if (isNumberInput) {
            dotKey = 'numero_' + dotKey;
            console.log("Clave con prefijo:", dotKey);
        }
        
        // Validar si la combinación existe en el mapa
        const characterFound = brailleMap[dotKey];
        if (characterFound) {
            console.log("Carácter encontrado:", characterFound);
            
            // Actualizar el estado y la referencia
            setCurrentCharacter(characterFound);
            currentCharRef.current = characterFound; // Actualizar la referencia inmediatamente
            console.log("Estado actualizado directamente a:", characterFound, "Referencia:", currentCharRef.current);
            
            // Generar descripción de los puntos para anunciar (sin mencionar el carácter)
            const description = validNumbers.length === 1 
                ? `punto ${validNumbers[0]}` 
                : `puntos ${validNumbers.join(', ')}`;
            
            // Solo anunciar los puntos seleccionados, no el carácter resultante
            speakMessage(`Has seleccionado ${description}.`);
        } else {
            // Si la combinación no existe en el mapa, limpiar el carácter actual
            console.log("No se encontró carácter para la clave:", dotKey);
            setCurrentCharacter('');
            currentCharRef.current = ''; // Actualizar la referencia inmediatamente
            
            const message = validNumbers.length === 1 
                ? `Has seleccionado punto ${validNumbers[0]}.` 
                : `Has seleccionado puntos ${validNumbers.join(', ')}.`;
                
            speakMessage(message);
        }
        
        // Para propósitos de depuración, verificar después de un tiempo
        setTimeout(() => {
            console.log("VERIFICACIÓN tras handleNumberCombination - Estado:", currentCharacter, "Referencia:", currentCharRef.current);
        }, 100);
    };

    // Actualizar el carácter actual basado en los puntos activos
    const updateCurrentCharacter = (char) => {
        if (char) {
            console.log("Actualizando carácter actual a:", char);
            setCurrentCharacter(char);
        } else {
            console.log("Limpiando carácter actual");
            setCurrentCharacter('');
        }
    };

    // Confirmar el carácter actual y añadirlo a la contraseña
    const confirmCharacter = () => {
        // Leer directamente desde la referencia para evitar problemas de sincronización
        const charToAdd = currentCharRef.current;
        console.log("Ejecutando confirmCharacter. Carácter actual (estado):", currentCharacter);
        console.log("Carácter actual (referencia):", charToAdd);
        
        if (charToAdd) {
            // Usar los valores de referencia para asegurar consistencia
            const currentPassword = passwordRef.current;
            const currentDisplay = displayPasswordRef.current;
            const newPassword = currentPassword + charToAdd;
            const newDisplay = currentDisplay + charToAdd;
            
            // Guardar la combinación de puntos actual para el resumen final
            const currentDotCombinations = dotCombinationsRef.current;
            const newDotCombinations = [...currentDotCombinations, [...activeDots]];
            setDotCombinations(newDotCombinations);
            dotCombinationsRef.current = newDotCombinations;
            
            console.log("Antes de actualizar - Password (ref):", currentPassword, "Display (ref):", currentDisplay);
            console.log("Guardando combinación de puntos:", activeDots);
            
            // Actualizar ambos estados de forma consistente
            setPassword(prevPassword => {
                const updatedPassword = prevPassword + charToAdd;
                console.log("Actualizando password a:", updatedPassword);
                return updatedPassword;
            });
            
            setDisplayPassword(prevDisplay => {
                const updatedDisplay = prevDisplay + charToAdd;
                console.log("Actualizando display a:", updatedDisplay);
                return updatedDisplay;
            });
            
            // Actualizar referencias inmediatamente
            passwordRef.current = newPassword;
            displayPasswordRef.current = newDisplay;
            
            // Limpiar el estado actual
            setActiveDots([]);
            setCurrentCharacter('');
            currentCharRef.current = ''; // Actualizar la referencia inmediatamente
            
            // Dar feedback sobre la operación, sin mencionar el carácter específico
            const feedbackMessage = `Puntos confirmados. Longitud actual: ${newPassword.length} caracteres`;
            console.log(feedbackMessage);
            speakMessage(feedbackMessage);
            
            // Actualizar mensaje para el usuario
            setMessage(`Posición ${newPassword.length} confirmada. Total: ${newPassword.length} caracteres`);
            
            setTimeout(() => {
                // Verificación adicional después de un tiempo
                console.log("VERIFICACIÓN POSTERIOR - Password (ref):", passwordRef.current, "Display (ref):", displayPasswordRef.current);
                console.log("Combinaciones guardadas:", dotCombinationsRef.current);
            }, 1000);
        } else {
            console.log("No hay carácter para confirmar. Estado:", currentCharacter, "Referencia:", currentCharRef.current);
            playAudio('brailleError');
            speakMessage("No hay ningún carácter para confirmar. Primero debes activar al menos un punto.");
        }
    };

    // Eliminar el último carácter de la contraseña
    const deleteLastCharacter = () => {
        // Usar referencia para el valor más actualizado
        const currentPassword = passwordRef.current;
        const currentDisplay = displayPasswordRef.current;
        const currentDotCombinations = dotCombinationsRef.current;
        
        console.log("deleteLastCharacter - Password actual (ref):", currentPassword, "Longitud:", currentPassword.length);
        
        if (currentPassword.length > 0) {
            console.log("Eliminando último carácter");
            
            const newPassword = currentPassword.slice(0, -1);
            const newDisplay = currentDisplay.slice(0, -1);
            const newDotCombinations = currentDotCombinations.slice(0, -1);
            
            // Actualizar referencias inmediatamente
            passwordRef.current = newPassword;
            displayPasswordRef.current = newDisplay;
            dotCombinationsRef.current = newDotCombinations;
            
            // Actualizar estados
            setPassword(newPassword);
            setDisplayPassword(newDisplay);
            setDotCombinations(newDotCombinations);
            
            console.log("Después del borrado - Password (ref):", passwordRef.current, "Display (ref):", displayPasswordRef.current);
            console.log("Combinaciones restantes:", dotCombinationsRef.current);
            
            playAudio('brailleCharacterDeleted');
        } else {
            console.log("No hay caracteres para eliminar");
            speakMessage("No hay caracteres para eliminar.");
        }
    };

    // Función para reproducir audio con Amazon Polly
    const speakWithPollyService = async (text) => {
        // Ya no intentamos usar Polly, usamos directamente la síntesis del navegador
        console.log("Usando síntesis de voz local para:", text);
        return speakMessage(text);
    };

    // Función para reproducir audio pregrabado con fallback a síntesis de voz
    const playBrailleAudio = async (type, char, dotsDescription = '') => {
        try {
            console.log(`Intentando reproducir audio braille para: ${type}, carácter: ${char}`);
            
            // Determinar qué archivo intentar reproducir
            let audioFile = '';
            let fallbackText = '';
            
            if (type === 'character_info') {
                // Audio solo con la descripción de los puntos, sin mencionar el carácter resultante
                audioFile = `braille/braille_${char}_info`;
                // Solo mencionar los puntos, no el carácter (por seguridad)
                fallbackText = `Has seleccionado ${dotsDescription}.`;
            } else if (type === 'character') {
                // Solo puntos, sin mencionar el carácter
                audioFile = `braille/braille_${char}`;
                fallbackText = `Puntos confirmados.`;
            } else if (type === 'intro') {
                audioFile = `braille/password_intro`;
                fallbackText = "Tu contraseña ha sido creada. A continuación escucharás cada uno de los caracteres.";
            } else if (type === 'completed') {
                audioFile = `braille/password_completed`;
                fallbackText = "Tu contraseña ha sido guardada correctamente.";
            } else if (type === 'char_prefix') {
                audioFile = `braille/password_char_prefix`;
                fallbackText = "Carácter";
            }
            
            // Intentar reproducir el audio pregrabado
            try {
                await playPredefinedMessage(audioFile);
                console.log(`✅ Audio pregrabado reproducido: ${audioFile}`);
                return true;
            } catch (audioError) {
                console.log(`❌ No se pudo reproducir audio pregrabado: ${audioFile}. Usando síntesis de voz.`);
                // Si falla, usar síntesis de voz como fallback
                await speakMessage(fallbackText);
                return true;
            }
        } catch (error) {
            console.error('Error en playBrailleAudio:', error);
            // En caso de error general, intentar síntesis de voz directamente
            if (dotsDescription) {
                await speakMessage(`Has seleccionado ${dotsDescription}.`);
            }
            return false;
        }
    };

    // Función mejorada para hablar un mensaje con posibilidad de usar audios pregrabados
    const speakBrailleCharacter = async (char, dotsDescription = '') => {
        // Intentar usar audio pregrabado primero, pero solo anunciando los puntos seleccionados
        try {
            // En lugar de usar el audio pregrabado que menciona el carácter, solo anunciar los puntos
            // await playBrailleAudio('character_info', char, dotsDescription);
            await speakMessage(`Has seleccionado ${dotsDescription}.`);
        } catch (error) {
            console.error('Error al reproducir audio para puntos braille:', error);
            // Fallback a síntesis de voz
            await speakMessage(`Has seleccionado ${dotsDescription}.`);
        }
    };

    // Función mejorada para reproducir el resumen de la contraseña
    const speakPasswordSummary = async () => {
        try {
            const combinations = dotCombinationsRef.current;
            const characters = displayPasswordRef.current.split('');
            
            console.log("Reproduciendo resumen de contraseña con combinaciones:", combinations);
            console.log("Caracteres de la contraseña:", characters);
            
            // Mensaje introductorio - intentar usar audio pregrabado
            await playBrailleAudio('intro');
            
            // Pequeña pausa
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Describir cada carácter usando los archivos de audio pregrabados
            for (let i = 0; i < characters.length; i++) {
                const char = characters[i];
                console.log(`Reproduciendo información para el carácter ${i+1}: "${char}"`);
                
                try {
                    // Usar directamente el archivo de audio de posición
                    const positionNumber = i + 1;
                    const positionAudioFile = `position_${positionNumber}`;
                    
                    try {
                        // Reproducir el audio de la posición ("posición X")
                        console.log(`Reproduciendo audio de posición: ${positionAudioFile}`);
                        await playPredefinedMessage(positionAudioFile);
                    } catch (positionError) {
                        console.error(`Error al reproducir posición ${positionNumber}:`, positionError);
                        // Fallback a síntesis de voz si falla
                        await speakMessage(`Posición ${positionNumber}`);
                    }
                    
                    // Pequeña pausa
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Reproducir el audio específico para este carácter
                    try {
                        // Intentar reproducir el archivo de audio específico para el carácter
                        console.log(`Intentando reproducir archivo braille/braille_${char}_info.mp3`);
                        await playPredefinedMessage(`braille/braille_${char}_info`);
                        console.log(`✅ Audio de carácter reproducido correctamente: braille_${char}_info`);
                    } catch (audioError) {
                        console.error(`❌ Error al reproducir audio para carácter "${char}":`, audioError);
                        
                        // Si falla el audio pregrabado, usar la descripción de puntos como fallback
                        const dotDescription = getDotsDescription(combinations[i]);
                        await speakMessage(`formado por ${dotDescription}.`);
                    }
                } catch (error) {
                    console.error(`Error al procesar carácter ${i+1}:`, error);
                    // Si falla completamente, usar la síntesis de voz como último recurso
                    const dotDescription = getDotsDescription(combinations[i]);
                    await speakMessage(`Posición ${i+1}: formado por ${dotDescription}.`);
                }
                
                // Pequeña pausa entre caracteres
                await new Promise(resolve => setTimeout(resolve, 800));
            }
            
            // Mensaje final con audio pregrabado si está disponible
            await playBrailleAudio('completed');
            
        } catch (error) {
            console.error("Error al reproducir resumen:", error);
            speakMessage("Ocurrió un error al reproducir el resumen de la contraseña.");
        }
    };

    // Completar la contraseña
    const completePassword = () => {
        // Usar referencia para el valor más actualizado
        const currentPassword = passwordRef.current;
        console.log("Intentando completar la contraseña. Longitud (ref):", currentPassword.length);
        
        // Leer desde la referencia por consistencia
        const charPending = currentCharRef.current;
        
        if (currentPassword.length > 0 || charPending) {
            let finalPassword = currentPassword;
            
            // Si hay un carácter activo, confirmarlo primero
            if (charPending) {
                finalPassword = currentPassword + charPending;
                console.log("Añadiendo último carácter antes de completar:", finalPassword);
                
                // Guardar la combinación de puntos actual
                const currentDotCombinations = dotCombinationsRef.current;
                const newDotCombinations = [...currentDotCombinations, [...activeDots]];
                
                // Actualizar estados y referencias con el carácter final
                passwordRef.current = finalPassword;
                displayPasswordRef.current = displayPasswordRef.current + charPending;
                dotCombinationsRef.current = newDotCombinations;
                
                setPassword(finalPassword);
                setDisplayPassword(displayPasswordRef.current);
                setDotCombinations(newDotCombinations);
                
                setActiveDots([]);
                setCurrentCharacter('');
                currentCharRef.current = ''; 
            }
            
            // En lugar de completar inmediatamente, activar el modo de edición 
            // y preguntar si el usuario quiere editar la contraseña
            console.log("Contraseña completada, preguntando si desea editarla:", finalPassword);
            console.log("Combinaciones finales:", dotCombinationsRef.current);
            
            playAudio('BraillePasswordLoginSaved');
            setStatus('completed');
            stopListening();
            
            // Reproducir el resumen de la contraseña
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            (async () => {
                await delay(1500); // Esperar antes de hablar
            
                await speakPasswordSummary(); // Habla resumen de la contraseña
            
                await delay(1000); // Espera antes de preguntar
            
                console.log("Preguntando si desea editar la contraseña");
                await startEditMode(); // Activa el modo de edición
            
                await delay(500); // Espera antes de empezar a escuchar
            
                if (recognitionRef.current) {
                    console.log("##############################");
                    console.log("Entrando a destiempo");
                    console.log("##############################");
                    startListening(); // Empieza a escuchar solo si está listo
                }
            })();
            
            
            
        } else {
            console.log("No se puede completar: contraseña vacía");
            playAudio('brailleError');
            speakMessage("No puedes finalizar sin introducir al menos un carácter.");
        }
    };

    // Iniciar la escucha de voz
    const startListening = () => {
        try {
            setTimeout(() => {
            playBeep();
            }, 1000);
            if(sessionStorage.getItem('brailleactivado') == 'true') {
                sessionStorage.removeItem('brailleactivado');
            }
            // Detener cualquier instancia previa si está en ejecución
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (error) {
                    console.log('Deteniendo reconocimiento previo:', error);
                    // Ignorar errores aquí, ya que podría no estar ejecutándose
                }
            }
            
            // Esperar un momento antes de iniciar el nuevo reconocimiento
            setTimeout(() => {
                try {
                    recognitionRef.current.start();
                    setListening(true);
                    setStatus('listening');
                    setMessage('Escuchando...');
                } catch (error) {
                    console.error('Error al iniciar reconocimiento:', error);
                    setMessage(`Error al iniciar reconocimiento: ${error.message}. Intenta hacer clic en el botón "Iniciar escucha"`);
                }
            }, 300);
        } catch (error) {
            console.error('Error general al iniciar reconocimiento:', error);
            setMessage(`Error general: ${error.message}. Intenta hacer clic en el botón "Iniciar escucha"`);
        }
    };

    // Detener la escucha de voz
    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setListening(false);
        setMessage('');
    };

    const playAudio = (audioName) => {
        return new Promise(async (resolve) => {
            try {
                console.log(`Reproduciendo mensaje: ${audioName}`);
                
                // Comprobar si es uno de los nuevos audios de edición
                if (audioName.startsWith('edit_') || audioName === 'position_selected') {
                    try {
                        await playPredefinedMessage(audioName);
                        resolve();
                    } catch (error) {
                        console.error(`Error al reproducir audio de edición ${audioName}:`, error);
                        // Fallback a mensajes de texto en caso de error
                        let fallbackMessage = "";
                        switch (audioName) {
                            case 'edit_password_question':
                                fallbackMessage = "¿Deseas editar tu contraseña? Dí 'editar' para modificarla o 'confirmar' para guardarla como está.";
                                break;
                            case 'edit_position_prompt':
                                fallbackMessage = "Dí la posición que deseas editar, por ejemplo 'posición 2'.";
                                break;
                            case 'edit_points_prompt':
                                fallbackMessage = "Ahora dí los puntos que deseas activar para esta posición.";
                                break;
                            case 'edit_from_scratch':
                                fallbackMessage = "¿Deseas crear la contraseña desde cero? Dí 'sí' para empezar de nuevo o 'no' para mantener la contraseña actual y editar posiciones específicas.";
                                break;
                            case 'edit_confirm':
                                fallbackMessage = "Dí 'confirmar' para guardar los cambios a tu contraseña.";
                                break;
                            case 'edit_success':
                                fallbackMessage = "Contraseña modificada correctamente.";
                                break;
                            case 'position_selected':
                                fallbackMessage = "Posición seleccionada. Ahora dí los puntos que deseas activar.";
                                break;
                            case 'edit_cancelled':
                                fallbackMessage = "Edición cancelada. Tu contraseña se mantiene como estaba.";
                                break;
                            default:
                                fallbackMessage = "Comando de edición no reconocido.";
                                break;
                        }
    
                        await speakMessage(fallbackMessage);
                        resolve();
                    }
                    return;
                }
    
                // Para mensajes normales con síntesis
                let message = "";
                switch (audioName) {
                    case 'braillePointsRecognized':
                        message = "Puntos reconocidos";
                        break;
                    case 'brailleCharacterConfirmed':
                        message = "Carácter confirmado";
                        break;
                    case 'brailleError':
                        message = "Error. Intenta de nuevo";
                        break;
                    case 'brailleCharacterDeleted':
                        message = "Último carácter eliminado";
                        break;
                    case 'braillePasswordSaved':
                        message = "Contraseña guardada correctamente";
                        break;
                    case 'brailleHelp':
                        message = "Di los números de los puntos braille que deseas activar, luego di siguiente para confirmar el carácter";
                        break;
                    default:
                        message = audioName;
                }
    
                if (message.trim()) {
                    setMessage(message);
                    await speakMessage(message);
                }
    
                resolve();
            } catch (error) {
                console.error(`Error general al manejar audio ${audioName}:`, error);
                setMessage(`Error de audio. Por favor, utiliza los botones en pantalla.`);
                resolve(); // Asegura que nunca se quede colgado
            }
        });
    };
    
    // Función para reproducir un archivo de audio pregrabado
    const playPredefinedMessage = (audioName) => {
        return new Promise((resolve, reject) => {
            try {
                console.log(`Intentando reproducir audio pregrabado: ${audioName}`);
                const audioPath = `${window.location.origin}/audio/${audioName}.mp3`;
                
                const audio = new Audio(audioPath);
                
                audio.addEventListener('error', (e) => {
                    console.error(`Error al cargar el audio ${audioName}:`, e);
                    reject(new Error(`No se pudo cargar el audio ${audioName}`));
                });
                
                audio.addEventListener('ended', () => {
                    console.log(`Audio ${audioName} terminado`);
                    resolve();
                });
                
                audio.play().catch(error => {
                    console.error(`Error al reproducir audio ${audioName}:`, error);
                    reject(error);
                });
            } catch (error) {
                console.error(`Error general al reproducir audio ${audioName}:`, error);
                reject(error);
            }
        });
    };

    // Mapeo de puntos braille a posiciones en la matriz
    const getBrailleDotClass = (position) => {
        return activeDots.includes(position) ? 'active' : '';
    };

    // Manejar los comandos de edición
    const handleEditCommands = (command) => {
        // Si está en modo edición
        if (editModeRef.current) {
            // Gestionar diferentes pasos del proceso de edición
            if (editStepRef.current === 'askEdit') {
                if (command.includes('editar') || command.includes('modificar') || command.includes('cambiar')) {
                    // Solo reproducir las instrucciones de edición si no se han reproducido antes
                    if (!playedEditInstructions) {
                        playAudio('edit_position_prompt');
                        setPlayedEditInstructions(true);
                        setPlayedPositionPrompt(true); // Marcar que ya se reprodujo el prompt de posición
                    } else {
                        speakMessage("Dí la posición que deseas editar, por ejemplo 'posición 2'.");
                    }
                    setEditStep('askPosition');
                    return true;
                } else if (command.includes('confirmar') || command.includes('guardar') || command.includes('aceptar')) {
                    // Salir del modo edición y completar el proceso
                    // Usar el audio de contraseña guardada en lugar del de contraseña modificada
                    playAudio('braillePasswordSaved');
                    setEditMode(false);
                    setEditStep('none');
                    
                    // Notificar que la contraseña está completa sin iniciar un nuevo ciclo de edición
                    if (onPasswordComplete) {
                        onPasswordComplete(passwordRef.current);
                    }
                    return true;
                } else if (command.includes('cancelar') || command.includes('salir')) {
                    // Salir del modo edición sin cambios
                    playAudio('edit_cancelled');
                    setEditMode(false);
                    setEditStep('none');
                    return true;
                }
            } 
            else if (editStepRef.current === 'askPosition') {
                // Buscar una mención a una posición, como "posición 2"
                const positionMatch = command.match(/posici[oóò]n\s+(\d+)/i);
                if (positionMatch) {
                    const position = parseInt(positionMatch[1]);
                    if (position > 0 && position <= passwordRef.current.length) {
                        setEditPosition(position - 1); // Ajustar a base 0
                        playAudio('position_selected');
                        setEditStep('editingPosition');
                        
                        // Cargar los puntos de la posición para poder editarlos
                        if (dotCombinationsRef.current[position - 1]) {
                            setActiveDots(dotCombinationsRef.current[position - 1]);
                            // Calcular el carácter correspondiente
                            let dotKey = dotCombinationsRef.current[position - 1].sort().join('');
                            const characterFound = brailleMap[dotKey];
                            if (characterFound) {
                                setCurrentCharacter(characterFound);
                                currentCharRef.current = characterFound;
                            }
                        }
                        
                        return true;
                    } else {
                        speakMessage(`La posición ${position} no es válida. Tu contraseña tiene ${passwordRef.current.length} caracteres.`);
                        return true;
                    }
                } 
                // Si menciona directamente un número
                const numberMatch = command.match(/\b(\d+)\b/);
                if (numberMatch) {
                    const position = parseInt(numberMatch[1]);
                    if (position > 0 && position <= passwordRef.current.length) {
                        setEditPosition(position - 1); // Ajustar a base 0
                        playAudio('position_selected');
                        setEditStep('editingPosition');
                        
                        // Cargar los puntos de la posición para poder editarlos
                        if (dotCombinationsRef.current[position - 1]) {
                            setActiveDots(dotCombinationsRef.current[position - 1]);
                            // Calcular el carácter correspondiente
                            let dotKey = dotCombinationsRef.current[position - 1].sort().join('');
                            const characterFound = brailleMap[dotKey];
                            if (characterFound) {
                                setCurrentCharacter(characterFound);
                                currentCharRef.current = characterFound;
                            }
                        }
                        
                        return true;
                    } else {
                        speakMessage(`La posición ${position} no es válida. Tu contraseña tiene ${passwordRef.current.length} caracteres.`);
                        return true;
                    }
                }
                else if (command.includes('salir') || command.includes('cancelar')) {
                    playAudio('edit_cancelled');
                    setEditMode(false);
                    setEditStep('none');
                    return true;
                }
                else if (command.includes('desde cero') || command.includes('empezar') || command.includes('nuevo')) {
                    playAudio('edit_from_scratch');
                    setEditStep('askFromScratch');
                    return true;
                }
            }
            else if (editStepRef.current === 'askFromScratch') {
                if (command.includes('sí') || command.includes('si') || command.includes('afirmativo') || command.includes('ok')) {
                    // Resetear la contraseña y salir del modo edición
                    setPassword('');
                    setDisplayPassword('');
                    setDotCombinations([]);
                    passwordRef.current = '';
                    displayPasswordRef.current = '';
                    dotCombinationsRef.current = [];
                    setActiveDots([]);
                    setCurrentCharacter('');
                    currentCharRef.current = '';
                    
                    // Salir del modo edición
                    setEditMode(false);
                    setEditStep('none');
                    speakMessage("Contraseña eliminada. Ahora puedes crear una nueva desde cero.");
                    return true;
                } else if (command.includes('no') || command.includes('negativo') || command.includes('cancelar')) {
                    // Volver a preguntar por la posición
                    playAudio('edit_position_prompt');
                    setEditStep('askPosition');
                    return true;
                }
            }
            else if (editStepRef.current === 'editingPosition') {
                // Si dice "confirmar" estando en modo edición de posición
                if (command.includes('confirmar') || command.includes('listo') || command.includes('siguiente') || 
                    command.includes('aceptar') || command.includes('ok')) {
                    confirmEditedPosition();
                    return true;
                }
                // Si dice "cancelar" estando en modo edición de posición
                else if (command.includes('cancelar') || command.includes('salir')) {
                    cancelPositionEdit();
                    return true;
                }
                
                // Si estamos editando una posición, procesar los números como en el modo normal
                // No manejarlos aquí, dejar que el flujo normal los procese
                return false;
            }
        }
        // Si no está en modo edición, comprobar si quiere entrar en modo edición
        else if (command.includes('editar') || command.includes('modificar') || command.includes('cambiar')) {
            startEditMode();
            return true;
        }
        
        // No era un comando de edición
        return false;
    };

    const startEditMode = async () => {
        if (passwordRef.current.length === 0) {
            await speakMessage("No hay una contraseña para editar.");
            return;
        }
    
        setEditMode(true);
        setEditStep('askEdit');
        setPlayedEditInstructions(false);
        setPlayedPositionPrompt(false);
    
        // Esperar a que se reproduzca completamente la pregunta
        await playAudio('edit_password_question');
    };
    
    // Confirmar los cambios hechos en la posición editada
    const confirmEditedPosition = () => {
        // Obtener el carácter actual desde la referencia
        const charToEdit = currentCharRef.current;
        const posToEdit = editPositionRef.current;
        
        if (charToEdit && posToEdit >= 0 && posToEdit < passwordRef.current.length) {
            console.log(`Editando posición ${posToEdit + 1}: reemplazando por "${charToEdit}"`);
            
            // Crear copias de las cadenas actuales
            const currentPassword = passwordRef.current;
            const currentDisplay = displayPasswordRef.current;
            const currentDotCombinations = [...dotCombinationsRef.current];
            
            // Actualizar las cadenas de contraseña
            const passwordChars = currentPassword.split('');
            passwordChars[posToEdit] = charToEdit;
            const newPassword = passwordChars.join('');
            
            const displayChars = currentDisplay.split('');
            displayChars[posToEdit] = charToEdit;
            const newDisplay = displayChars.join('');
            
            // Actualizar la combinación de puntos
            currentDotCombinations[posToEdit] = [...activeDots];
            
            // Actualizar los estados y referencias
            setPassword(newPassword);
            setDisplayPassword(newDisplay);
            setDotCombinations(currentDotCombinations);
            
            passwordRef.current = newPassword;
            displayPasswordRef.current = newDisplay;
            dotCombinationsRef.current = currentDotCombinations;
            
            // Limpiar estados actuales
            setActiveDots([]);
            setCurrentCharacter('');
            currentCharRef.current = '';
            
            // Dar feedback al usuario
            speakMessage(`Posición ${posToEdit + 1} actualizada. Puedes editar otra posición o confirmar los cambios.`);
            
            // Volver a preguntar por otra posición solo si no se ha reproducido ya
            setTimeout(() => {
                if (!playedPositionPromptRef.current) {
                    playAudio('edit_position_prompt');
                    setPlayedPositionPrompt(true);
                } else {
                    speakMessage("Puedes editar otra posición o confirmar los cambios.");
                }
                setEditStep('askPosition');
            }, 2000);
        } else {
            speakMessage("No hay cambios para confirmar en esta posición.");
            
            // Volver a preguntar por otra posición solo si no se ha reproducido ya
            setTimeout(() => {
                if (!playedPositionPromptRef.current) {
                    playAudio('edit_position_prompt');
                    setPlayedPositionPrompt(true);
                } else {
                    speakMessage("Puedes editar otra posición o confirmar los cambios.");
                }
                setEditStep('askPosition');
            }, 1500);
        }
    };

    // Cancelar la edición de posición actual
    const cancelPositionEdit = () => {
        setActiveDots([]);
        setCurrentCharacter('');
        currentCharRef.current = '';
        setEditPosition(-1);
        
        speakMessage("Edición de posición cancelada. Puedes elegir otra posición para editar.");
        
        setTimeout(() => {
            // Solo reproducir el prompt si no se ha reproducido antes
            if (!playedPositionPromptRef.current) {
                playAudio('edit_position_prompt');
                setPlayedPositionPrompt(true);
            } else {
                speakMessage("Puedes elegir otra posición para editar o confirmar los cambios.");
            }
            setEditStep('askPosition');
        }, 1500);
    };

    return (
        <div className="braille-password-container bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">Contraseña Braille</h3>
            
            <div className="mb-4 text-center">
                <p className="text-md text-gray-700">
                    {status === 'waiting' && 'Preparando reconocimiento de voz...'}
                    {status === 'listening' && 'Di los números de los puntos braille (1-6)'}
                    {status === 'processing' && 'Procesando...'}
                    {status === 'completed' && '¡Contraseña guardada!'}
                </p>
                
                {listening && (
                    <div className="mt-2 inline-flex items-center">
                        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2"></span>
                        <span className="text-sm text-green-600">Escuchando comandos de voz</span>
                    </div>
                )}
                
                {message && (
                    <p className="text-sm text-blue-600 mt-2">{message}</p>
                )}
            </div>

            <div className="braille-display mb-6">
                <div className="relative">
                    <div className="mb-2 text-center">
                        <span className="text-xs text-gray-500">Configuración de puntos Braille</span>
                    </div>
                    <div className="braille-cell">
                        <div 
                            className={`braille-dot ${getBrailleDotClass(1)}`} 
                            data-position="1"
                            aria-label="Punto braille 1"
                            title="Punto 1"
                        >1</div>
                        <div 
                            className={`braille-dot ${getBrailleDotClass(2)}`} 
                            data-position="2"
                            aria-label="Punto braille 2"
                            title="Punto 2"
                        >2</div>
                        <div 
                            className={`braille-dot ${getBrailleDotClass(3)}`} 
                            data-position="3"
                            aria-label="Punto braille 3"
                            title="Punto 3"
                        >3</div>
                        <div 
                            className={`braille-dot ${getBrailleDotClass(4)}`} 
                            data-position="4"
                            aria-label="Punto braille 4"
                            title="Punto 4"
                        >4</div>
                        <div 
                            className={`braille-dot ${getBrailleDotClass(5)}`} 
                            data-position="5"
                            aria-label="Punto braille 5"
                            title="Punto 5"
                        >5</div>
                        <div 
                            className={`braille-dot ${getBrailleDotClass(6)}`} 
                            data-position="6"
                            aria-label="Punto braille 6"
                            title="Punto 6"
                        >6</div>
                    </div>
                </div>
                
                <div className="current-braille-info mt-4 text-center">
                    {currentCharacter ? (
                        <div>
                            {/* Mostrar el carácter en la interfaz visual */}
                            <span className="text-2xl font-bold block">{currentCharacter}</span>
                            <span className="text-xs text-gray-500">
                                Puntos seleccionados: {activeDots.join(', ')}
                            </span>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-500">Indica números para activar puntos</span>
                    )}
                </div>
            </div>

            <div className="password-display mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña creada:</label>
                <div className="h-8 flex items-center justify-center">
                    {displayPassword ? (
                        <span className="text-lg tracking-widest font-mono text-primary-600 font-bold">
                            {/* Mostrar los caracteres reales de la contraseña */}
                            {displayPassword}
                        </span>
                    ) : (
                        <span className="text-sm text-gray-500 italic">No hay caracteres aún</span>
                    )}
                </div>
                {displayPassword.length > 0 && (
                    <div className="mt-2 text-center">
                        <span className="text-xs text-gray-500">
                            Longitud: {displayPassword.length} {displayPassword.length === 1 ? 'carácter' : 'caracteres'}
                        </span>
                    </div>
                )}
            </div>

            <div className="voice-commands mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2 text-center">Comandos de voz disponibles:</h4>
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white rounded shadow-sm">
                        <span className="text-sm font-medium block text-blue-700">1-6</span>
                        <span className="text-xs text-gray-600">Activar puntos braille</span>
                    </div>
                    <div className="p-2 bg-white rounded shadow-sm">
                        <span className="text-sm font-medium block text-blue-700">Siguiente</span>
                        <span className="text-xs text-gray-600">Confirmar puntos seleccionados</span>
                    </div>
                    <div className="p-2 bg-white rounded shadow-sm">
                        <span className="text-sm font-medium block text-blue-700">Borrar</span>
                        <span className="text-xs text-gray-600">Eliminar última posición</span>
                    </div>
                    <div className="p-2 bg-white rounded shadow-sm">
                        <span className="text-sm font-medium block text-blue-700">He terminado</span>
                        <span className="text-xs text-gray-600">Finalizar contraseña</span>
                    </div>
                </div>
            </div>

            <div className="controls flex flex-wrap gap-2 justify-center">
                <button 
                    onClick={startListening} 
                    disabled={listening || status === 'completed'} 
                    className="px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50 flex items-center"
                    aria-label="Iniciar reconocimiento de voz"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                    Iniciar escucha
                </button>
                <button 
                    onClick={stopListening} 
                    disabled={!listening || status === 'completed'} 
                    className="px-4 py-2 bg-red-600 text-white rounded-md disabled:opacity-50 flex items-center"
                    aria-label="Detener reconocimiento de voz"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm8-8a8 8 0 11-16 0 8 8 0 0116 0zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                    Detener escucha
                </button>
                <button 
                    onClick={confirmCharacter} 
                    disabled={!currentCharacter || status === 'completed'} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 flex items-center"
                    aria-label="Confirmar carácter actual"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Confirmar
                </button>
                <button 
                    onClick={deleteLastCharacter} 
                    disabled={password.length === 0 || status === 'completed'} 
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md disabled:opacity-50 flex items-center"
                    aria-label="Borrar último carácter"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6.707 4.879A3 3 0 018.828 4H15a3 3 0 013 3v6a3 3 0 01-3 3H8.828a3 3 0 01-2.12-.879l-4.415-4.414a1 1 0 010-1.414l4.414-4.414zm4 2.414a1 1 0 00-1.414 1.414L10.586 10l-1.293 1.293a1 1 0 101.414 1.414L12 11.414l1.293 1.293a1 1 0 001.414-1.414L13.414 10l1.293-1.293a1 1 0 00-1.414-1.414L12 8.586l-1.293-1.293z" clipRule="evenodd" />
                    </svg>
                    Borrar
                </button>
                <button 
                    onClick={completePassword} 
                    disabled={password.length === 0 || status === 'completed'} 
                    className="px-4 py-2 bg-purple-600 text-white rounded-md disabled:opacity-50 flex items-center"
                    aria-label="Finalizar y guardar contraseña"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Finalizar
                </button>
            </div>
        </div>
    );
};

export default BraillePasswordLogin;