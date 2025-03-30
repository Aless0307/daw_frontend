import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-blue-700 text-white px-6 py-4 shadow-md">
      <div className="flex justify-between items-center max-w-6xl mx-auto">
        <h1 className="text-xl font-bold">Mi Sitio</h1>
        <ul className="flex space-x-4">
          <li>
            <Link to="/" className="hover:underline">Inicio</Link>
          </li>
          <li>
            <Link to="/acerca" className="hover:underline">Acerca</Link>
          </li>
          <li>
            <Link to="/contacto" className="hover:underline">Contacto</Link>
          </li>
          <li>
            <Link to="/login" className="hover:underline">Iniciar Sesión</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
