import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import GoogleClientIdChecker from "./GoogleClientIdChecker";
import "./LoginPage.css";

export default function LoginPage() {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [clientIdConfigured, setClientIdConfigured] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    // Verificar si el Client ID está configurado
    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
        const isConfigured = clientId && clientId !== "TU_CLIENT_ID.apps.googleusercontent.com";
        setClientIdConfigured(isConfigured);
    }, []);

    const handleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError(null);

        // Validar que el credential existe
        if (!credentialResponse || !credentialResponse.credential) {
            setError("No se recibió el credential de Google. Por favor, intenta nuevamente.");
            setLoading(false);
            return;
        }

        try {
            const result = await login(credentialResponse.credential);
            
            if (result.success) {
                navigate("/", { replace: true });
            } else {
                setError(result.error || "Error al iniciar sesión. Por favor, intenta nuevamente.");
            }
        } catch (err) {
            console.error("Error en login:", err);
            // Mostrar el mensaje de error específico si está disponible
            const errorMessage = err.message || 
                                err.response?.data?.message || 
                                err.response?.data?.error ||
                                "Error al conectar con el servidor. Por favor, verifica que el backend esté corriendo e intenta nuevamente.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleError = (error) => {
        console.error("Error de Google OAuth:", error);
        
        // Manejar diferentes tipos de errores de Google OAuth
        if (error.type === "popup_closed_by_user") {
            setError("La ventana de inicio de sesión fue cerrada. Por favor, intenta nuevamente.");
        } else if (error.type === "popup_blocked") {
            setError("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.");
        } else if (error.type === "idpiframe_initialization_failed") {
            setError("Error al inicializar Google OAuth. Verifica que el Client ID esté configurado correctamente.");
        } else {
            setError("Error al iniciar sesión con Google. Verifica que el Client ID esté configurado correctamente en Google Cloud Console.");
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <span className="app-eyebrow">Acceso seguro</span>
                <h1>Entra a tu demo profesional</h1>
                <p>
                    Inicia sesión con Google para cargar tu perfil, conversar con tu IA y mostrar una experiencia distinta a un CV tradicional.
                </p>

                <div className="login-benefits">
                    <span>✨ Perfil recruiter-ready</span>
                    <span>💬 Chat en primera persona</span>
                    <span>📄 CV interactivo</span>
                </div>

                {error && <div className="error-message">{error}</div>}

                {!clientIdConfigured && <GoogleClientIdChecker />}

                {clientIdConfigured && (
                    <>
                        <div className="login-button-container">
                            <GoogleLogin onSuccess={handleSuccess} onError={handleError} disabled={loading} />
                        </div>

                        <div className="login-helper-copy">
                            <strong>Qué pasa después</strong>
                            <ul>
                                <li>Completas tu perfil profesional</li>
                                <li>Abres tu demo conversacional</li>
                                <li>Compartes una experiencia mucho más clara con recruiters</li>
                            </ul>
                        </div>
                    </>
                )}

                {loading && <p className="loading-text">Iniciando sesión...</p>}
            </div>
        </div>
    );
}
