import React from "react";

/**
 * Error Boundary global — captura errores en cualquier componente hijo
 * y muestra una UI de fallback en lugar de romper toda la app.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("[ErrorBoundary]", error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = "/";
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="loading-container">
                <div className="loading-card" style={{ textAlign: "center", gap: "1.2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span className="app-eyebrow">Error inesperado</span>
                    <h2 style={{ margin: 0, color: "var(--danger)" }}>Algo salió mal</h2>
                    <p style={{ color: "var(--muted)", margin: 0, maxWidth: 380 }}>
                        Ocurrió un error en esta sección. Podés intentar volver al inicio o recargar la página.
                    </p>
                    {this.state.error?.message && (
                        <code style={{
                            background: "rgba(248,113,113,0.08)",
                            color: "var(--danger)",
                            padding: "0.5rem 1rem",
                            borderRadius: 8,
                            fontSize: "0.8rem",
                            maxWidth: 400,
                            wordBreak: "break-word",
                        }}>
                            {this.state.error.message}
                        </code>
                    )}
                    <button
                        onClick={this.handleReset}
                        style={{
                            marginTop: "0.5rem",
                            padding: "0.65rem 1.6rem",
                            background: "var(--primary)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "0.95rem",
                        }}
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }
}
