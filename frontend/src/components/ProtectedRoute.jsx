import React, { useState } from "react";
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

function AccesoRestringido({ requiredRole }) {
    const { role, updateRole } = useAuth();
    const [activating, setActivating] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const handleActivate = async () => {
        setActivating(true);
        setFeedback(null);
        const result = await updateRole("recruiter");
        if (result.success) {
            setFeedback({ type: "success", message: "¡Cuenta recruiter activada! Recargando..." });
            setTimeout(() => window.location.reload(), 1200);
        } else {
            setFeedback({ type: "error", message: result.error || "No se pudo activar el modo recruiter." });
            setActivating(false);
        }
    };

    const roleLabel = requiredRole === "recruiter" ? "reclutadores" : requiredRole;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
                padding: "var(--space-8, 2rem)",
                textAlign: "center",
            }}
        >
            <div
                style={{
                    background: "var(--color-surface, #ffffff)",
                    border: "1px solid var(--color-border, #e2e8f0)",
                    borderRadius: "var(--radius-lg, 1rem)",
                    padding: "var(--space-8, 2rem)",
                    maxWidth: "480px",
                    width: "100%",
                    boxShadow: "var(--shadow-md, 0 4px 16px rgba(0,0,0,0.08))",
                }}
            >
                <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-4, 1rem)" }}>🔒</div>
                <span
                    style={{
                        display: "inline-block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--color-text-muted, #64748b)",
                        marginBottom: "var(--space-3, 0.75rem)",
                    }}
                >
                    Acceso restringido
                </span>
                <h2
                    style={{
                        fontSize: "var(--font-size-xl, 1.25rem)",
                        fontWeight: 700,
                        color: "var(--color-text, #1e293b)",
                        marginBottom: "var(--space-3, 0.75rem)",
                    }}
                >
                    Esta sección es para {roleLabel}
                </h2>
                <p
                    style={{
                        color: "var(--color-text-muted, #64748b)",
                        fontSize: "var(--font-size-sm, 0.875rem)",
                        marginBottom: "var(--space-6, 1.5rem)",
                        lineHeight: 1.6,
                    }}
                >
                    Tu cuenta actual tiene el rol{" "}
                    <strong
                        style={{
                            background: "var(--color-surface-2, #f1f5f9)",
                            padding: "0.1em 0.4em",
                            borderRadius: "0.25rem",
                            color: "var(--color-text, #1e293b)",
                        }}
                    >
                        {role}
                    </strong>
                    . Para acceder a esta sección necesitás activar el modo recruiter.
                </p>

                {role === "candidate" && !feedback && (
                    <button
                        type="button"
                        onClick={handleActivate}
                        disabled={activating}
                        style={{
                            background: "var(--color-primary, #6366f1)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "var(--radius-md, 0.5rem)",
                            padding: "0.75rem 1.5rem",
                            fontSize: "var(--font-size-sm, 0.875rem)",
                            fontWeight: 600,
                            cursor: activating ? "not-allowed" : "pointer",
                            opacity: activating ? 0.7 : 1,
                            transition: "opacity 0.2s",
                        }}
                    >
                        {activating ? "Activando..." : "Activar cuenta recruiter"}
                    </button>
                )}

                {feedback && (
                    <p
                        style={{
                            marginTop: "var(--space-4, 1rem)",
                            padding: "0.75rem 1rem",
                            borderRadius: "var(--radius-md, 0.5rem)",
                            background:
                                feedback.type === "success"
                                    ? "var(--color-success-bg, #f0fdf4)"
                                    : "var(--color-error-bg, #fef2f2)",
                            color:
                                feedback.type === "success"
                                    ? "var(--color-success, #16a34a)"
                                    : "var(--color-error, #dc2626)",
                            fontSize: "var(--font-size-sm, 0.875rem)",
                            fontWeight: 500,
                        }}
                    >
                        {feedback.message}
                    </p>
                )}
            </div>
        </div>
    );
}

export function RoleRoute({ children, requiredRole }) {
    const { isAuthenticated, loading, onboardingCompleted, role } = useAuth();
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

    if (role !== requiredRole) {
        return <AccesoRestringido requiredRole={requiredRole} />;
    }

    return children;
}

