import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext";
import App from "./App.jsx";
import "./index.css";

// ⚙️ Google Client ID desde variables de entorno
// IMPORTANTE: El Client ID debe estar configurado en el archivo .env
// Si no está configurado, Google OAuth mostrará un error "invalid_client"
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "TU_CLIENT_ID.apps.googleusercontent.com") {
  console.error(
    "⚠️ ADVERTENCIA: VITE_GOOGLE_CLIENT_ID no está configurado correctamente.\n" +
    "Por favor, agrega tu Google Client ID al archivo .env:\n" +
    "VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com"
  );
}

// Verificar que el Client ID esté configurado antes de renderizar
if (!GOOGLE_CLIENT_ID) {
  console.error(
    "❌ ERROR: VITE_GOOGLE_CLIENT_ID no está configurado.\n" +
    "Por favor, crea un archivo .env en la raíz del proyecto con:\n" +
    "VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com\n\n" +
    "Ver la guía completa: CONFIGURACION_GOOGLE_OAUTH.md"
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {GOOGLE_CLIENT_ID ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    ) : (
      <div style={{ 
        padding: "2rem", 
        textAlign: "center", 
        fontFamily: "sans-serif",
        maxWidth: "600px",
        margin: "50px auto"
      }}>
        <h1 style={{ color: "#c33" }}>⚠️ Error de Configuración</h1>
        <p style={{ margin: "1rem 0", lineHeight: "1.6" }}>
          El Google Client ID no está configurado correctamente.
        </p>
        <p style={{ margin: "1rem 0", lineHeight: "1.6" }}>
          Por favor, crea un archivo <code style={{ 
            background: "#f4f4f4", 
            padding: "2px 6px", 
            borderRadius: "4px" 
          }}>.env</code> en la raíz del proyecto con:
        </p>
        <pre style={{ 
          background: "#f4f4f4", 
          padding: "1rem", 
          borderRadius: "8px",
          textAlign: "left",
          overflow: "auto"
        }}>
{`VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
VITE_API_BASE_URL=http://localhost:3000`}
        </pre>
        <p style={{ margin: "1rem 0", lineHeight: "1.6" }}>
          <strong>Importante:</strong> Después de crear el archivo <code>.env</code>, 
          reinicia el servidor de desarrollo.
        </p>
        <p style={{ margin: "1rem 0", lineHeight: "1.6" }}>
          <a 
            href="./CONFIGURACION_GOOGLE_OAUTH.md" 
            style={{ color: "#0078ff", textDecoration: "none" }}
          >
            Ver guía completa de configuración
          </a>
        </p>
        <p style={{ margin: "1rem 0", lineHeight: "1.6" }}>
          <a 
            href="./SOLUCION_ERROR_401_INVALID_CLIENT.md" 
            style={{ color: "#0078ff", textDecoration: "none" }}
          >
            Ver solución para error 401 "invalid_client"
          </a>
        </p>
      </div>
    )}
  </React.StrictMode>
);
