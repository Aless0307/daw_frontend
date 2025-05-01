import React from 'react';
import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AccessibleLogin from './pages/AccessibleLogin';
import Acerca from './pages/Acerca';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Contact from './pages/Contact';
import ProtectedRoute from './components/ProtectedRoute';

// Una vez que inicié sesión...
import Home from './pages/LoggedIn/Home';
import Logica from './pages/LoggedIn/Logica';

const AppLayout = () => {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col min-h-screen">
      {/*user && <Navbar /> aquí comento esto para evitar la duplicidad, ya que ya tengo una que funciona y es responsiva, entonces está mejor,
      ya que también me permite seguir viendo el funcionamiento si es que quito lo de protected route*/}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<AccessibleLogin />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/home" />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/acerca" element={<Acerca />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path ="/logica" element={<Logica />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      {user && <Footer />}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppLayout />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
