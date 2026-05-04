import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, loading, onboardingCompleted } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="page-shell protected-route-state">
                <div className="loading-card">
                    <span className="app-eyebrow">Acceso protegido</span>
                    <div className="loading">Verificando tu sesión...</div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!onboardingCompleted && location.pathname !== "/onboarding") {
        return <Navigate to="/onboarding" replace />;
    }

    return children;
}

