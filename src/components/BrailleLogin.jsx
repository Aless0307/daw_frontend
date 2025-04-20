import React, { useState } from 'react';
import BraillePassword from './BraillePassword';
import { config } from '../config';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * BrailleLogin component: Handles Braille password input for LOGIN ONLY.
 * Props:
 *   - email: User email (confirmed)
 *   - onLogin: Function to call with email and password when login is attempted
 *   - onCancel: Function to call to return to previous step
 */
const BrailleLogin = ({ email, onLogin, onCancel }) => {
    const [braillePassword, setBraillePassword] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handlePasswordComplete = async (password) => {
        console.log('🔐 Iniciando proceso de login con contraseña braille...');
        setBraillePassword(password);
        setIsComplete(true);
        setError(null);
        setIsSubmitting(true);
    
        try {
            sessionStorage.setItem('email', email);
            sessionStorage.setItem('password', password);
    
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);
    
            console.log('📤 Enviando datos al backend:', {
                endpoint: `${config.API_URL}/auth/login`,
                username: email,
                password
            });
    
            const response = await fetch(`${config.API_URL}/auth/login`, {
                method: 'POST',
                body: formData
            });
    
            console.log('📥 Respuesta recibida del servidor:', response);
    
            if (!response.ok) {
                const errData = await response.json();
                let errorMsg = 'Error en el inicio de sesión';
    
                if (typeof errData.detail === 'string') errorMsg = errData.detail;
                else if (typeof errData.msg === 'string') errorMsg = errData.msg;
                else if (Array.isArray(errData) && errData.length && typeof errData[0].msg === 'string') errorMsg = errData[0].msg;
                else errorMsg = JSON.stringify(errData);
    
                console.error('❌ Error en login:', errorMsg);
                setError(errorMsg);
                setIsSubmitting(false);
                return;
            }
    
            const data = await response.json();
            const token = data.access_token;
            sessionStorage.setItem('access_token', token);
            console.log('✅ Login exitoso. Datos recibidos:', data);
    
            if (!data.access_token) {
                console.error('❌ No se recibió access_token en la respuesta.');
                throw new Error('No se recibió token en la respuesta');
            }
    
            login({
                token: data.access_token,
                username: data.username || email,
                email: data.email || email
            });
    
            console.log('➡️ Login ejecutado correctamente. Redirigiendo a /home...');
            navigate('/home');
        } catch (err) {
            console.error('🚨 Error inesperado al iniciar sesión:', err);
            setError('Error al conectar con el servidor');
            setIsSubmitting(false);
        }
    };
    
    

    return (
        <div className="braille-login-container">
            <h2>Inicio de sesión con contraseña Braille</h2>
            <p>Correo: <strong>{email}</strong></p>
            <BraillePassword onPasswordComplete={handlePasswordComplete} />
            {isSubmitting && <div className="text-blue-600 mt-2">Enviando datos...</div>}
            {error && <div className="error">{error}</div>}
            <button onClick={onCancel} className="mt-4" disabled={isSubmitting}>Volver</button>
        </div>
    );
};

export default BrailleLogin;
