import React from "react";

export default function GoogleClientIdChecker() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Solo mostrar el mensaje si el Client ID no está configurado
  if (clientId && clientId !== "TU_CLIENT_ID.apps.googleusercontent.com" && clientId.trim() !== "") {
    return null;
  }

  return (
    <div className="client-id-warning">
      <div className="warning-content">
        <h3>⚠️ Configuración requerida</h3>
        <p>
          Para activar el login y probar la experiencia completa, configura tu Google Client ID en el frontend.
        </p>
        <ol>
          <li>
            Ve a <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>
          </li>
          <li>Crea un nuevo proyecto o selecciona uno existente</li>
          <li>Configura credenciales OAuth 2.0 para una app web</li>
          <li>Agrega tu Client ID al archivo <code>.env</code> como <code>VITE_GOOGLE_CLIENT_ID</code></li>
          <li>Reinicia el servidor de desarrollo</li>
        </ol>
        <p className="warning-note">
          <strong>Nota:</strong> el archivo <code>.env</code> debe vivir en la raíz del proyecto para que Vite lo cargue correctamente.
        </p>
      </div>
    </div>
  );
}

