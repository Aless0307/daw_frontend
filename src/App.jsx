import React from 'react';
import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Acerca from './pages/Acerca';
import { checkAuth } from './utils/auth';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  
  if (!user || !checkAuth()) {
    return <Navigate to="/login" />;
  }

  return children;
};

const Layout = () => {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col min-h-screen">
      {user && <Navbar />}
      <main className="flex-grow">
        <Routes future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Route path="/login" element={<Login />} />
          <Route path="/acerca" element={<Acerca />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/home" />} />
        </Routes>
      </main>
      {user && <Footer />}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
