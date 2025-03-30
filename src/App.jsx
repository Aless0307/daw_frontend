import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Inicio from "./pages/Inicio";      
import Acerca from "./pages/Acerca";
import Contacto from "./pages/Contacto";
import Login from "./pages/Login";
import Home from "./pages/Home";
import { useEffect } from "react";
import { checkAuth } from "./utils/auth";
import { AuthProvider } from "./context/AuthContext";

// Componente para proteger rutas que requieren autenticación
const ProtectedRoute = ({ children }) => {
    const navigate = useNavigate();
    
    useEffect(() => {
        if (!checkAuth()) {
            navigate('/login');
        }
    }, [navigate]);
    
    return checkAuth() ? children : null;
};

function App() {
    return (
        <AuthProvider>
            <Navbar />
            <Routes>
                <Route path="/inicio" element={<Inicio />} />       
                <Route path="/acerca" element={<Acerca />} />
                <Route path="/contacto" element={<Contacto />} />
                <Route path="/login" element={<Login />} />
                <Route 
                    path="/home" 
                    element={
                        <ProtectedRoute>
                            <Home />
                        </ProtectedRoute>
                    } 
                />
                <Route path="/" element={<Navigate to="/login" />} />
            </Routes>
            <Footer />
        </AuthProvider>
    );
}

export default App;
