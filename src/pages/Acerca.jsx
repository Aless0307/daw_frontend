import React from 'react';

const Acerca = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Acerca de la Aplicación
              </h1>
              <div className="prose max-w-none">
                <p className="text-gray-600 mb-4">
                  Esta aplicación es un sistema de autenticación que permite a los usuarios registrarse e iniciar sesión utilizando diferentes métodos:
                </p>
                <ul className="list-disc list-inside text-gray-600 mb-4">
                  <li>Registro tradicional con email y contraseña</li>
                  <li>Registro con grabación de voz opcional</li>
                  <li>Inicio de sesión con email y contraseña</li>
                  <li>Inicio de sesión mediante reconocimiento de voz</li>
                </ul>
                <p className="text-gray-600">
                  La aplicación utiliza tecnologías modernas como:
                </p>
                <ul className="list-disc list-inside text-gray-600">
                  <li>React para el frontend</li>
                  <li>FastAPI para el backend</li>
                  <li>Neo4j para la base de datos</li>
                  <li>Azure Blob Storage para almacenar grabaciones de voz</li>
                  <li>Resemblyzer para el procesamiento de voz</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Acerca;
