import { useEffect, useState } from 'react';
import axiosInstance from '../utils/axios';

export default function Acerca() {
  const nombre = "Alessandro";
  const año = new Date().getFullYear();
  const [mensajeBackend, setMensajeBackend] = useState('');

  useEffect(() => {
    const obtenerSaludo = async () => {
      try {
        const response = await axiosInstance.get('/api/saludo');
        setMensajeBackend(response.data.mensaje);
      } catch (error) {
        console.error('Error al obtener el saludo:', error);
        setMensajeBackend('Error al cargar el saludo');
      }
    };

    obtenerSaludo();
  }, []);

  function saludar() {
    return `Hola, ${nombre}!`;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Acerca de mí</h1>
      <p>{saludar()} Bienvenido a mi sitio web.</p>
      <p className="mt-4 text-blue-600">{mensajeBackend}</p>
      <p>© {año}</p>
    </div>
  );
}
