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
                <header className="login-header">
                    <span className="app-eyebrow">Acceso seguro</span>
                    <h1>Inicia tu entrevista virtual</h1>
                    <p>
                        Entra con tu cuenta de Google para abrir tu perfil profesional, conversar con tu asistente y compartir tu CV interactivo.
                    </p>
                </header>

                <section className="login-steps" aria-label="Pasos para comenzar">
                    <h2>Como funciona</h2>
                    <ol>
                        <li>Inicia sesion con Google</li>
                        <li>Completa tu perfil en pocos minutos</li>
                        <li>Comparte tu demo con recruiters</li>
                    </ol>
                </section>

                <div className="login-benefits" aria-label="Beneficios principales">
                    <span className="benefit-pill">Perfil recruiter-ready</span>
                    <span className="benefit-pill">Chat en primera persona</span>
                    <span className="benefit-pill">CV interactivo</span>
                </div>

                {error && (
                    <div className="error-message" role="alert" aria-live="assertive">
                        {error}
                    </div>
                )}

                {!clientIdConfigured && <GoogleClientIdChecker />}

                {clientIdConfigured && (
                    <>
                        <div className="login-button-container" aria-label="Accion principal de inicio de sesion">
                            <p className="login-button-title">Continuar con Google</p>
                            <GoogleLogin onSuccess={handleSuccess} onError={handleError} disabled={loading} />
                        </div>

                        <div className="login-helper-copy">
                            <strong>Que pasa despues</strong>
                            <ul>
                                <li>Acceso seguro sin contraseñas nuevas</li>
                                <li>Tu informacion queda asociada a tu cuenta</li>
                                <li>Puedes continuar luego donde te quedaste</li>
                            </ul>
                        </div>
                    </>
                )}

                {loading && (
                    <p className="loading-text" role="status" aria-live="polite">
                        Iniciando sesion...
                    </p>
                )}
            </div>
        </div>
    );
}
