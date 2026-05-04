import React from "react";
import { Navigate } from "react-router-dom";
import OnboardingWizard from "../components/OnboardingWizard";
import { useAuth } from "../context/AuthContext";

export default function OnboardingPage() {
    const { loading, onboardingCompleted } = useAuth();

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-card">
                    <span className="app-eyebrow">Preparando onboarding</span>
                    <div className="loading">Cargando tu progreso...</div>
                </div>
            </div>
        );
    }

    if (onboardingCompleted) {
        return <Navigate to="/perfil" replace />;
    }

    return <OnboardingWizard />;
}
