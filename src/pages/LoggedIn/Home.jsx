import React, { useEffect, useState } from 'react'; // Importa useEffect y useState aquí
import { useAuth } from '../../context/AuthContext';
import { config } from "../../config"; // Asegúrate de que la ruta sea correcta: '../../config' si está en src/config.js
// Importa el componente Sidebar. Ajusta la ruta según la ubicación real de tu archivo Sidebar.jsx
import Sidebar from './Componentes-Iniciado/SideBar'; // <-- Ajusta esta ruta si es necesario
// Importa el componente Navbar. Ajusta la ruta según la ubicación real de tu archivo Navbar.jsx
import Navbar from '../../components/Navbar'; // <-- Ajusta esta ruta si es necesario


const Home = () => {
  // user y logout se asumen que vienen del contexto de autenticación
  const { user, logout } = useAuth();

  // --- Estado para controlar la expansión de la Sidebar ---
  // Este estado se compartirá con el componente Sidebar
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // Función para actualizar el estado de expansión (se pasará a Sidebar)
  // Sidebar llamará a esta función cuando su estado de hover cambie
  const handleSidebarToggle = (expanded) => {
    setIsSidebarExpanded(expanded);
  };
  // --- Fin del Estado de la Sidebar ---


  // Define la función fetchUserId AQUÍ dentro del componente Home
  const fetchUserId = async () => {
    const emtemp = sessionStorage.getItem('email');

    if (!emtemp) {
        console.error('Error: No se encontró el email en sessionStorage.');
        // Aquí podrías redirigir al usuario a la página de login si el email no está en sesión
        // navigate('/login'); // Si usas react-router-dom y tienes el hook navigate
        return; // Salir si no hay email
    }

    // CORRECCIÓN DE URL: Añadimos el prefijo '/auth' y usamos backticks para template literal
    // Asumiendo que config.API_URL es como 'http://localhost:8003' o 'https://dawbackend-production.up.railway.app'
    const url = `${config.API_URL}/auth/user_by_email?email=${encodeURIComponent(emtemp)}`; // <-- AÑADIR /auth aquí y usar backticks

    const headers = {
      // 'Content-Type': 'application/json' no es necesario para GET sin body
      'Accept': 'application/json', // Indicar que esperas JSON
      'Authorization': `Bearer ${sessionStorage.getItem('access_token')}` // Asegúrate de que el token exista en sessionStorage
    };

    // Las opciones de fetchOptions del archivo config.js son útiles aquí
    // Asumiendo que fetchOptionsFromConfig es accesible o definido aquí
    const fetchOptionsFromConfig = {
        credentials: 'include', // Necesario porque incluyes headers de auth o si usas cookies
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow',
        timeout: 10000 // 10 segundos
    };

    try {
        // Usar el método GET
        const response = await fetch(url, {
          method: 'GET', // Método GET
          headers: headers,
          ...fetchOptionsFromConfig // Incluir otras opciones de config.js
          // NO hay 'body' en una solicitud GET
        });

        if (!response.ok) {
            // Manejar respuestas que no son 2xx (ej: 404, 401, 500)
            // Intentar leer el error del backend si la respuesta no está vacía
            const errorBody = await response.text(); // Leer como texto si json() falla
            let errorData = null;
            try {
                 errorData = JSON.parse(errorBody);
            } catch (e) {
                 errorData = errorBody; // Si no es JSON, usar el texto
            }


            console.error(`Error al obtener el ID del usuario: ${response.status} ${response.statusText}`, errorData);
            // Aquí podrías manejar errores específicos, como 401 (No autorizado)
            // if (response.status === 401) { logout(); navigate('/login'); } // Ejemplo
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Intentar parsear JSON solo si la respuesta fue exitosa
        const data = await response.json();

        // Acceder a data._id (campo devuelto por MongoDB)
        if (data && data._id) {
            console.log('ID del usuario obtenido:', data._id); // Log más específico
            sessionStorage.setItem('user_id', data._id);
            console.log('ID del usuario guardado en sessionStorage.');
        } else {
             console.error('Error: La respuesta de la API no contiene el campo "_id" o es inválida.', data);
        }

    } catch (error) {
        console.error('Error en la llamada fetch para obtener el ID del usuario:', error);
        // Aquí podrías mostrar un mensaje al usuario o manejar el error de red
    }
  };

  // Usa useEffect para llamar a fetchUserId cuando el componente se monta
  // El array vacío [] asegura que esto solo se ejecute una vez al montar
  useEffect(() => {
    console.log('Componente Home montado. Intentando obtener ID del usuario...');
    fetchUserId(); // Llama a la función aquí
  }, []); // Dependencia vacía: solo se ejecuta al montar

  // Datos estáticos para la sección de Características
  const features = [
    {
      title: 'Autenticación por Voz',
      description: 'Sistema de seguridad biométrico avanzado que utiliza tu voz como identificación única.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )
    },
    {
      title: 'Seguridad Avanzada',
      description: 'Protección de datos de última generación con encriptación de extremo a extremo.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    {
      title: 'Acceso Instantáneo',
      description: 'Inicio de sesión rápido y seguro utilizando tecnología de reconocimiento de voz.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    }
  ];

  // Asegúrate de que 'user' tenga las propiedades 'username' y 'email'
  // que esperas recibir de tu contexto o estado de autenticación
  const displayUsername = user?.username || 'Usuario'; // Mostrar 'Usuario' si user o username es undefined
  const displayEmail = user?.email || 'Cargando...'; // Mostrar 'Cargando...' si user o email es undefined
  const logoutFunction = logout || (() => { console.warn("Logout function not provided") }); // Manejar si logout no está disponible

  // Calcula el padding izquierdo para el contenido principal basado en el estado de la sidebar
  // --- ¡IMPORTANTE! ---
  // Asegúrate de que estos valores (60 y 250) coincidan EXACTAMENTE
  // con los valores de 'width' definidos en tu archivo SideBar.css
  const sidebarCollapsedWidth = 60; // px
  const sidebarExpandedWidth = 250; // px
  const mainContentPaddingLeft = isSidebarExpanded ? sidebarExpandedWidth : sidebarCollapsedWidth;


  return (
    // Contenedor principal que usa flexbox para la barra lateral y el contenido
    // min-h-screen asegura que ocupe al menos la altura completa de la pantalla
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar - Se coloca a la izquierda */}
      {/* Pasa el estado de expansión y el handler para que Sidebar los use */}
      {/* No aplicamos el ancho aquí, Sidebar lo maneja internamente con sus clases CSS */}
      {/* Sidebar tiene position: fixed, por lo que NO ocupa espacio en el layout flex del contenedor padre */}
      <Sidebar
        isExpanded={isSidebarExpanded} // Pasa el estado de expansión
        onToggleExpansion={handleSidebarToggle} // Pasa la función para actualizar el estado (llamada por Sidebar en hover)
        user={user} // Pasa el prop user si Sidebar lo necesita
        logout={logoutFunction} // Pasa el prop logout si Sidebar lo necesita
      /> {/* <-- Añade tu componente Sidebar aquí */}

      {/* Contenedor del Contenido Principal - Ocupa el espacio restante */}
      {/* flex-1 hace que ocupe todo el espacio disponible en el flex container */}
      {/* min-w-0 permite que este contenedor se encoja por debajo de su tamaño de contenido si es necesario */}
      {/* overflow-x-hidden oculta cualquier contenido horizontal que se desborde dentro de este contenedor */}
      {/* Añadimos padding-left dinámico para empujar el contenido y que NO se solape con la sidebar fija */}
      <div
        className="flex-1 min-w-0 overflow-x-hidden"
        style={{ paddingLeft: `${mainContentPaddingLeft}px`, transition: 'padding-left 0.3s ease' }} // Aplica padding dinámico y transición suave
      >
        {/* Navbar - Se coloca en la parte superior del contenido principal */}
        {/* El Navbar se ajustará al ancho disponible dentro de este contenedor flex-1 */}
        {/* No necesita padding-left adicional aquí, ya que su contenedor padre (este div) ya tiene el padding */}
        <Navbar /> {/* <-- Añade tu componente Navbar aquí */}

        {/* Hero Section */}
        {/* El resto del contenido de la página */}
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto">
            {/* El padding horizontal (px-4, etc.) dentro de main ya maneja el espacio lateral interno */}
            {/* No necesitas padding-left adicional en los elementos internos si el padding del contenedor flex-1 ya lo maneja */}
            <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:w-full lg:pb-28 xl:pb-32">
              <main className="mt-10 mx-auto px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
                <div className="sm:text-center lg:text-left">
                  <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                    <span className="block">Bienvenido,</span>
                    {/* Usar el displayUsername seguro */}
                    <span className="block text-indigo-600">{displayUsername}</span>
                  </h1>
                  <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                    Sistema de autenticación biométrica por voz
                  </p>
                </div>

                {/* Stats Section */}
                <div className="mt-10">
                  <dl className="rounded-lg bg-white shadow-lg sm:grid sm:grid-cols-3">
                    <div className="flex flex-col border-b border-gray-100 p-6 text-center sm:border-0 sm:border-r">
                      <dt className="order-2 mt-2 text-lg leading-6 font-medium text-gray-500">Email</dt>
                      {/* Usar el displayEmail seguro */}
                      <dd className="order-1 text-2xl font-extrabold text-indigo-600">{displayEmail}</dd>
                    </div>
                    <div className="flex flex-col border-t border-b border-gray-100 p-6 text-center sm:border-0 sm:border-l sm:border-r">
                      <dt className="order-2 mt-2 text-lg leading-6 font-medium text-gray-500">Sesión</dt>
                      <dd className="order-1 text-5xl font-extrabold text-indigo-600">Activa</dd>
                    </div>
                    <div className="flex flex-col border-t border-gray-100 p-6 text-center sm:border-0 sm:border-l">
                      <dt className="order-2 mt-2 text-lg leading-6 font-medium text-gray-500">Estado</dt>
                      <dd className="order-1 text-5xl font-extrabold text-green-600">✓</dd>
                    </div>
                  </dl>
                </div>
              </main>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:text-center">
              <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Características</h2>
              <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Sistema de Autenticación Avanzado
              </p>
              <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
                Descubre las características que hacen único nuestro sistema de autenticación por voz.
              </p>
            </div>

            <div className="mt-10">
              <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
                {features.map((feature) => (
                  <div key={feature.title} className="relative">
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                      {feature.icon}
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">{feature.title}</p>
                    <dd className="mt-2 ml-16 text-base text-gray-500">{feature.description}</dd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="bg-gray-50">
          <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              <span className="block">¿Listo para salir?</span>
              <span className="block text-indigo-600">Cierra tu sesión de forma segura.</span>
            </h2>
            <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
              <div className="inline-flex rounded-md shadow">
                {/* Usar la función de logout segura */}
                <button
                  onClick={logoutFunction}
                  className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transform transition-all duration-200 hover:scale-105"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </div>

      </div> {/* Cierre del contenedor del contenido principal */}
    </div> // Cierre del contenedor flex principal
  );
};

export default Home;
