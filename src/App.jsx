import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Inicio from "./pages/Inicio";      
import Acerca from "./pages/Acerca";
import Contacto from "./pages/Contacto";
import Login from "./pages/Login";
import Home from "./pages/Home";

// Componente para proteger rutas que requieren autenticación
const ProtectedRoute = ({ children }) => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        return <Navigate to="/login" />;
    }
    
    return children;
};

function App() {
    return (
        <>
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
        </>
    );
}

export default App;
