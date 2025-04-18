import { config } from '../config';

// Función para procesar el texto del usuario usando el backend
export const processUserInput = async (userInput) => {
    try {
        const response = await fetch(`${config.API_URL}/ai/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                userInput,
                context: "login_accessibility"
            })
        });

        if (!response.ok) {
            throw new Error('Error al procesar el texto');
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Error al procesar con Groq:', error);
        throw error;
    }
}; 