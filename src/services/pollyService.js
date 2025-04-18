// Servicio para integrar Amazon Polly

// URL del backend (ajusta esto según tu configuración)
const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

/**
 * Solicita la síntesis de voz usando Amazon Polly
 * @param {string} text - Texto a sintetizar
 * @param {string} voiceId - ID de la voz (por defecto 'Conchita' para español)
 * @returns {Promise<ArrayBuffer>} - ArrayBuffer con el audio
 */
export const synthesizeSpeech = async (text, voiceId = 'Conchita') => {
  try {
    // Verificar que hay texto para sintetizar
    if (!text || text.trim() === '') {
      throw new Error('No text provided for synthesis');
    }

    // Enviar solicitud al backend que maneja la integración con Amazon Polly
    const response = await fetch(`${API_URL}/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voiceId,
        languageCode: 'es-ES' // Español de España
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error en la síntesis de voz');
    }

    // Obtener el audio como ArrayBuffer
    const audioData = await response.arrayBuffer();
    return audioData;
  } catch (error) {
    console.error('Error en Polly Service:', error);
    throw error;
  }
};

/**
 * Reproduce audio sintetizado por Amazon Polly
 * @param {string} text - Texto a sintetizar y reproducir
 * @returns {Promise<void>}
 */
export const speakWithPolly = async (text) => {
  try {
    console.log('Solicitando síntesis a Amazon Polly:', text);
    
    // Intentar usar el servicio de Amazon Polly
    const audioData = await synthesizeSpeech(text);
    
    // Crear un Blob con los datos de audio
    const blob = new Blob([audioData], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    
    // Reproducir el audio
    const audio = new Audio(url);
    
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url); // Liberar recursos
        resolve();
      };
      
      audio.onerror = (error) => {
        URL.revokeObjectURL(url);
        console.error('Error al reproducir audio:', error);
        reject(error);
      };
      
      audio.play().catch(error => {
        console.error('Error al iniciar reproducción:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error en speakWithPolly:', error);
    // En caso de error, devolvemos una promesa resuelta para no interrumpir el flujo
    return Promise.resolve();
  }
};

export default {
  synthesizeSpeech,
  speakWithPolly
}; 