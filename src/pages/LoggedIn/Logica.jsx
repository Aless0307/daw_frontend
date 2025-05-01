import React, { useState, useRef } from 'react';
// Importa la librería cliente oficial de Google Generative AI para JS
import { GoogleGenerativeAI } from '@google/generative-ai';
// Importa el componente de reconocimiento de voz (renombrado)
import VoiceRecognition from './Componentes-Iniciado/Micro-enter';
// Importa el componente Navbar
import Navbar from '../../components/Navbar';
import SideBar from './Componentes-Iniciado/SideBar';
import './Logica.css';

// --- ¡¡¡ ADVERTENCIA DE SEGURIDAD !!! ---
// !!! NO PONGAS TU CLAVE DE API DIRECTAMENTE AQUÍ EN CÓDIGO PARA PRODUCCIÓN !!!
// Esto es solo para demostración. Para producción, la llamada a la API debe hacerse desde un BACKEND SEGURO.
const API_KEY = "AIzaSyClAldN4Lvq3HjK1MgogyFdMzitzAqAkXM";

const MiComponenteBasico = () => {
  // Estados para manejar la comunicación con Gemini
  const [geminiResponse, setGeminiResponse] = useState('');
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [geminiError, setGeminiError] = useState('');

  // Referencias para la comunicación con Gemini
  const genAiRef = useRef(null);
  const modelRef = useRef(null);
  const isGeminiCallingRef = useRef(false);

  // Configuración de Gemini
  const MODEL_NAME = 'gemini-2.0-flash';
  const generationConfig = {
    "temperature": 0.5,
  };

  // Contexto específico para esta sección - personalizable
  const CONTEXT_PREFIX = "Eres un asistente experto en programación web. ";
  const PROMPT_PREFIX = CONTEXT_PREFIX + "Responde de forma concisa a lo siguiente: ";

  // Función para enviar el texto reconocido a Gemini
  const sendToGemini = async (text, isClearRequest = false) => {
    // Si es una solicitud de limpieza, simplemente resetear los estados
    if (isClearRequest) {
      setGeminiResponse('');
      setGeminiError('');
      return;
    }

    // Evitar enviar prompts vacíos o si ya hay una llamada en curso
    if (!text.trim() || isLoadingGemini || isGeminiCallingRef.current) {
      console.log("Saltando llamada a Gemini: texto vacío o ya hay una llamada en progreso.");
      return;
    }

    setIsLoadingGemini(true);
    isGeminiCallingRef.current = true;
    setGeminiResponse('');
    setGeminiError('');

    try {
      // Inicializar el cliente y el modelo si no existen ya
      if (!genAiRef.current) {
        if (!API_KEY) {
          throw new Error("API Key de Gemini no configurada correctamente.");
        }
        genAiRef.current = new GoogleGenerativeAI(API_KEY);
      }
      if (!modelRef.current) {
        modelRef.current = genAiRef.current.getGenerativeModel({
          model: MODEL_NAME,
          generationConfig: generationConfig,
        });
      }

      // Construir el prompt completo con el prefijo del contexto
      const fullPrompt = PROMPT_PREFIX + text;
      console.log("Enviando a Gemini:", fullPrompt);

      // Llamar a la API usando streaming
      const result = await modelRef.current.generateContentStream(fullPrompt);

      // Procesar el stream de respuesta
      let responseText = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text() || '';
        responseText += chunkText;
        setGeminiResponse(prev => prev + chunkText);
      }

      console.log("Respuesta de Gemini finalizada.");

    } catch (e) {
      console.error("Error llamando a la API de Gemini:", e);
      setGeminiError(`Error de Gemini: ${e.message || 'Desconocido'}. Verifica tu API key y la consola.`);
      setGeminiResponse('');
    } finally {
      setIsLoadingGemini(false);
      isGeminiCallingRef.current = false;
    }
  };

  return (
    <div className="app-container">
      <SideBar />
      <main className="content">
        <Navbar />

        <h1>Centro de ayuda de programación</h1>
        <p>Haz preguntas sobre programación web y nuestro asistente te ayudará.</p>

        {/* Componente de reconocimiento de voz con props para la comunicación */}
        <VoiceRecognition 
          onTextRecognized={sendToGemini}
          responseData={geminiResponse}
          isLoadingResponse={isLoadingGemini}
          responseError={geminiError}
        />

        {/* ADVERTENCIA DE SEGURIDAD EN EL FRONTEND */}
        <div style={{ color: '#e65100', backgroundColor: '#fff3e0', borderColor: '#ffcc80', padding: '15px', border: '1px solid', borderRadius: '8px', margin: '20px', fontSize: '0.9em' }}>
          <p style={{ fontWeight: 'bold' }}>⚠️ ADVERTENCIA DE SEGURIDAD (Solo Desarrollo):</p>
          <p>La clave de API de Gemini está en el código frontend. Esto NO es seguro para producción.</p>
          <p>Para producción, envía el texto reconocido a un <strong>backend</strong> seguro que realice la llamada a la API de Gemini con tu clave.</p>
        </div>
      </main>
    </div>
  );
};

export default MiComponenteBasico;