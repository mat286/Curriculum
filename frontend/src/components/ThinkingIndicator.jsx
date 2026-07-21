import React from "react";
import "./ThinkingIndicator.css";

/**
 * Indicador de fase mientras la IA procesa ("Analizando...", "Buscando...",
 * "Generando respuesta..."). El backend ya manda estas fases por SSE — este
 * componente solo pinta el label ya mapeado (ver useStreamingChat.js).
 */
export default function ThinkingIndicator({ label }) {
    if (!label) return null;
    return (
        <div className="ui-thinking">
            <span className="ui-thinking-dot" aria-hidden="true" />
            <span>{label}</span>
        </div>
    );
}
