// src/utils/api.js

// Helper para obtener el token. Asume que AuthContext lo guarda en localStorage O sessionStorage
const getAuthTokenFromStorage = () => {
    let token = localStorage.getItem('token');
    if (!token) {
        token = sessionStorage.getItem('access_token');
    }
    // console.log("getAuthTokenFromStorage found token:", !!token);
    return token;
};

const API_BASE_URL = "http://127.0.0.1:8003/auth/api/logic"; // Ajusta si tu base URL cambió

const fetchAuthenticated = async (endpoint, options = {}) => {
    const token = getAuthTokenFromStorage();

    // No lanzar error aquí si no hay token, el backend lo hará (401)
    // pero sí es bueno loguearlo para depuración.
    if (!token) {
        console.warn(`WorkspaceAuthenticated: No token found for endpoint: ${endpoint}. Request will likely fail.`);
        // Dejar que la llamada falle y sea manejada por el backend y el catch general.
    }

    const headers = {
        ...options.headers, // Permite pasar otros headers
        // 'Content-Type' se añadirá o no dependiendo del 'body'
    };
    // Solo añadir Authorization si hay token
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Para FormData o URLSearchParams, fetch pone el Content-Type correcto automáticamente.
    // Si 'body' es un objeto JS y method es POST/PUT/PATCH, lo convertimos a JSON
    // y seteamos Content-Type, a menos que ya se haya seteado.
    if (options.body && typeof options.body === 'object' &&
        !(options.body instanceof FormData) &&
        !(options.body instanceof URLSearchParams) &&
        !headers['Content-Type'] // No sobrescribir si ya está
    ) {
        options.body = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
    }


    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`Calling API: ${options.method || 'GET'} ${url}`);

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            let errorDetail = `API error: ${response.status} ${response.statusText}`;
            let errorBody = null;
            try {
                errorBody = await response.json(); // Intentar parsear cuerpo del error
                errorDetail += ` - ${errorBody.detail || JSON.stringify(errorBody)}`;
            } catch (e) { /* No se pudo parsear el cuerpo del error, no hacer nada */ }
            console.error("API call failed:", errorDetail, "Full response:", response);
            const error = new Error(errorDetail);
            error.status = response.status;
            error.body = errorBody; // Guardar el cuerpo del error por si es útil
            throw error;
        }

        // Si la respuesta es 204 No Content o similar, no intentar parsear JSON
        if (response.status === 204) {
             console.log("API call successful (204 No Content).");
             return null; // O un objeto indicando éxito, ej. { success: true }
        }

        // Intentar parsear como JSON si hay contenido
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            console.log("API call successful. Response data:", data);
            return data;
        } else {
            // Si no es JSON, devolver texto (o manejar como error si siempre esperas JSON)
            const textData = await response.text();
            console.log("API call successful. Response text data:", textData);
            return textData; // O podrías lanzar un error si esperabas JSON
        }

    } catch (e) {
        // Esto captura errores de red (Failed to fetch) y errores lanzados arriba
        console.error(`Workspace operation failed for ${url}:`, e);
        throw e; // Re-lanzar para que el componente lo maneje
    }
};

export const getUserProgress = async () => {
    return fetchAuthenticated('/progress');
};

export const getLogicProblem = async (difficulty = null) => {
    const query = difficulty ? `?difficulty=${difficulty}` : '';
    return fetchAuthenticated(`/problem${query}`);
};

export const submitLogicAnswer = async (problemId, answerText) => {
     console.log("Submitting answer via API:", { problem_id: problemId, answer_text: answerText });
     // URLSearchParams envía como application/x-www-form-urlencoded
     // que FastAPI maneja con Form(...)
     return fetchAuthenticated('/submit_answer', {
         method: 'POST',
         body: new URLSearchParams({
             problem_id: problemId,
             user_answer: answerText
         }),
         // No necesitas Content-Type aquí, fetch lo deduce de URLSearchParams
     });
};

export const getAuthenticatedUserFromSession = () => {
    const token = getAuthTokenFromStorage();
    const email = sessionStorage.getItem('email');
    const username = sessionStorage.getItem('username');
    
    if (!token || !email) {
        return null;
    }
    
    return {
        token,
        email,
        username: username || email
    };
};