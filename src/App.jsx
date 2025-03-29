import { useState, useEffect } from "react";

function App() {
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    fetch("https://daw-backend.onrender.com/api/saludo")
      .then((res) => res.json())
      .then((data) => setMensaje(data.mensaje))
      .catch((err) => console.error("Error al conectar al backend:", err));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white shadow-md rounded-lg p-6 text-center">
        <h1 className="text-2xl font-bold mb-4 text-blue-700">
          Frontend conectado al Backend 🎉
        </h1>
        <p className="text-gray-800">{mensaje || "Cargando..."}</p>
      </div>
    </div>
  );
}

export default App;
