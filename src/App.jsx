import React from 'react';
import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AccessibleLogin from './pages/AccessibleLogin';
import Home from './pages/Home';
import Acerca from './pages/Acerca';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Contact from './pages/Contact';
import ProtectedRoute from './components/ProtectedRoute';

const AppLayout = () => {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col min-h-screen">
      {user && <Navbar />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<AccessibleLogin />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/home" />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/acerca" element={<Acerca />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
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
