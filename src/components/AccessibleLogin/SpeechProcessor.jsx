import { queueAudioMessage, AUDIO_MESSAGES, playWithFallback } from './AudioService';

export class SpeechProcessor {
    constructor(updateAppState, setUsername, setEmail, setShowBrailleInput, handleStopListening, isListening) {
        this.updateAppState = updateAppState;
        this.setUsername = setUsername;
        this.setEmail = setEmail;
        this.setShowBrailleInput = setShowBrailleInput;
        this.handleStopListening = handleStopListening;
        this.isListening = isListening;
    }

    // Función para procesar el texto reconocido
    processUserSpeech = (text, isRegistering, showVoiceLogin, showFaceLogin) => {
        console.log('===================== PROCESANDO TEXTO =====================');
        console.log('Texto recibido:', text);
        console.log('Estado actual - isRegistering:', isRegistering);
        console.log('Estado actual - showVoiceLogin:', showVoiceLogin);
        console.log('Estado actual - showFaceLogin:', showFaceLogin);
        
        if (!text) {
            console.log('⚠️ No hay texto para procesar');
            return;
        }
        
        // Normalizar el texto para facilitar la detección de comandos
        const normalizedText = text.toLowerCase().trim();
        
        // Función para verificar si el texto contiene alguna de las palabras clave
        const containsAny = (keywords) => {
            return keywords.some(keyword => normalizedText.includes(keyword));
        };
        
        // Si estamos en modo registro, verificar si el usuario está proporcionando datos
        if (isRegistering) {
            console.log('🧩 Procesando input durante registro');
            
            // Patrones para reconocer datos de registro
            const usernamePattern1 = /mi nombre (de usuario )?es\s+([a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]+)/i;
            const usernamePattern2 = /([a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]+)\s+es mi nombre/i;
            const usernamePattern3 = /me llamo\s+([a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]+)/i;
            const emailPattern3 = /mi (correo|email|mail|e-mail|dirección)( electrónico)? es ([a-zA-Z0-9]+)( guion bajo| guión bajo| underscore)([a-zA-Z0-9]+) arroba ([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
            
            // Verificar si está diciendo su nombre de usuario
            let match;
            if ((match = normalizedText.match(usernamePattern1))) {
                const extractedUsername = match[2];
                console.log('✅ Nombre de usuario reconocido (patrón 1):', extractedUsername);
                this.setUsername(extractedUsername);
                queueAudioMessage(AUDIO_MESSAGES.userNameConfirmed);
                setTimeout(() => {
                    playWithFallback("askEmail", "Por favor, dime tu correo electrónico.");
                }, 2000);
                return;
            } else if ((match = normalizedText.match(usernamePattern2))) {
                const extractedUsername = match[1];
                console.log('✅ Nombre de usuario reconocido (patrón 2):', extractedUsername);
                this.setUsername(extractedUsername);
                queueAudioMessage(AUDIO_MESSAGES.userNameConfirmed);
                setTimeout(() => {
                    playWithFallback("askEmail", "Por favor, dime tu correo electrónico.");
                }, 2000);
                return;
            } else if ((match = normalizedText.match(usernamePattern3))) {
                const extractedUsername = match[1];
                console.log('✅ Nombre de usuario reconocido (patrón 3):', extractedUsername);
                this.setUsername(extractedUsername);
                queueAudioMessage(AUDIO_MESSAGES.userNameConfirmed);
                setTimeout(() => {
                    playWithFallback("askEmail", "Por favor, dime tu correo electrónico.");
                }, 2000);
                return;
            }
            
            // Si el texto es muy corto y está en modo de registro, probablemente sea solo el nombre
            if (normalizedText.length > 2 && normalizedText.length < 20 && !normalizedText.includes(' ')) {
                console.log('✅ Posible nombre de usuario directo:', normalizedText);
                this.setUsername(normalizedText);
                queueAudioMessage(AUDIO_MESSAGES.userNameConfirmed);
                setTimeout(() => {
                    playWithFallback("askEmail", "Por favor, dime tu correo electrónico.");
                }, 2000);
                return;
            }
            
            this.handleEmailRecognition(normalizedText);
        }
        
        // Procesar comandos de navegación general
        // Palabras clave para cada acción
        const registerKeywords = ['registrar', 'registro', 'crear cuenta', 'nueva cuenta', 'inscribirme', 
                                'registrarme', 'inscribir', 'registra', 'registrame', 'inscribirte'];
        const loginKeywords = ['iniciar', 'login', 'entrar', 'sesión', 'iniciar sesión', 'entrar sesión', 
                               'inicia', 'ingreso', 'ingresar', 'acceder', 'acceso'];
        const voiceKeywords = ['voz', 'reconocimiento de voz', 'hablar', 'por voz'];
        const faceKeywords = ['cara', 'facial', 'reconocimiento facial', 'rostro', 'mi cara', 'fotografía'];
        const cancelKeywords = ['cancelar', 'volver', 'regresar', 'atrás', 'salir', 'cancela'];
        
        console.log('Analizando comando en texto normalizado:', normalizedText);
        
        // Procesar comandos de navegación general primero, independientemente del estado actual
        if (containsAny(loginKeywords)) {
            console.log('✅ Comando reconocido: iniciar sesión');
            this.updateAppState('login');
            return;
        } 
        
        if (containsAny(registerKeywords)) {
            console.log('✅ Comando reconocido: registrarse');
            console.log('Palabras clave detectadas: registrar, registro, crear cuenta, etc.');
            this.updateAppState('register');
            return;
        } 
        
        if (containsAny(voiceKeywords)) {
            console.log('✅ Comando reconocido: login por voz');
            this.updateAppState('voiceLogin');
            return;
        } 
        
        if (containsAny(faceKeywords)) {
            console.log('✅ Comando reconocido: login facial');
            this.updateAppState('faceLogin');
            return;
        }

        // Si llegamos aquí, no fue un comando de navegación principal
        // Ahora procesamos comandos específicos del estado actual
        if (isRegistering || showVoiceLogin || showFaceLogin) {
            if (containsAny(cancelKeywords)) {
                console.log('✅ Comando reconocido: cancelar/volver');
                this.updateAppState('backToMain');
                return;
            }
        }
        
        // Si llegamos aquí, no se reconoció ningún comando
        console.log('❌ Comando no reconocido');
        console.log('Comandos disponibles: "iniciar sesión", "registrarse", "voz", "facial", "cancelar"');
    };

    // Funciones auxiliares para el procesamiento de email
    letterToCharMap = {
        a: 'a', be: 'b', ce: 'c', de: 'd', e: 'e', efe: 'f', ge: 'g',
        hache: 'h', i: 'i', jota: 'j', ka: 'k', ele: 'l', eme: 'm', ene: 'n',
        eñe: 'ñ', o: 'o', pe: 'p', cu: 'q', ere: 'r', ese: 's', te: 't',
        u: 'u', ve: 'v', uve: 'v', 'doble ve': 'w', equis: 'x', ye: 'y', zeta: 'z',
        'i griega': 'y', cero: '0', uno: '1', dos: '2', tres: '3', cuatro: '4',
        cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
    };
    
    specialMap = {
        'guion bajo': '_', 'guión bajo': '_', underscore: '_',
        'guion medio': '-', 'guión medio': '-', menos: '-',
        punto: '.', dot: '.', arroba: '@',
    };
    
    normalizeSpokenEmail = (text) => {
        let processed = text.toLowerCase();
    
        for (const [key, val] of Object.entries(this.specialMap)) {
            processed = processed.replaceAll(key, ` ${val} `);
        }
    
        const words = processed.split(/\s+/).filter(Boolean);
        const emailParts = words.map(w => this.letterToCharMap[w] || w).join('');
        return emailParts;
    }
    
    confirmEmail = (email) => {
        this.setEmail(email);
        queueAudioMessage(AUDIO_MESSAGES.emailConfirmed);
        queueAudioMessage(AUDIO_MESSAGES.passwordConfirmed);
    
        let verbalEmail = '';
        for (const char of email) {
            verbalEmail += {
                '@': ' arroba ',
                '.': ' punto ',
                '_': ' guion bajo ',
                '-': ' guion medio ',
            }[char] || char + ' ';
        }
    
        if (this.isListening) this.handleStopListening();
        this.setShowBrailleInput(true);
        console.log('✅ Correo confirmado y se activa interfaz de braille:', email);
    }
    
    handleEmailRecognition = (normalizedText) => {
        const spokenText = this.normalizeSpokenEmail(normalizedText);
        const emailRegex = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const match = spokenText.match(emailRegex);
    
        if (match) {
            const email = `${match[1]}@${match[2]}`;
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                this.confirmEmail(email);
            } else {
                console.warn('❌ Email inválido después de procesar:', email);
            }
        } else {
            console.log('⚠️ Texto no contiene email reconocido:', spokenText);
        }
    }
}

export default SpeechProcessor;
