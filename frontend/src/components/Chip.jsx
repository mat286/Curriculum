import React from "react";
import "./Chip.css";

/** Pill gris claro para skills/idiomas — un solo componente, un solo lugar para el estilo. */
export default function Chip({ children }) {
    if (!children) return null;
    return <span className="ui-chip">{children}</span>;
}
