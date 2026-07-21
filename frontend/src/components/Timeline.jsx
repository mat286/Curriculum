import React from "react";
import "./Timeline.css";

function formatDateRange(item) {
    const start = item?.fechaInicio;
    const end = item?.enCurso ? "Actualidad" : item?.fechaFin;
    if (!start && !end) return "";
    if (start && end) return `${start} · ${end}`;
    return start || end || "";
}

/**
 * Timeline vertical estilo LinkedIn — un punto + línea por ítem de experiencia/educación.
 * Reusa el mismo shape que ya normaliza profileNormalizers.js (titulo, organizacion, fechas, enCurso).
 */
export default function Timeline({ items = [] }) {
    if (items.length === 0) return null;

    return (
        <ul className="ui-timeline">
            {items.map((item, idx) => (
                <li key={item.id || idx} className="ui-timeline-item">
                    <span className="ui-timeline-dot" aria-hidden="true" />
                    <div className="ui-timeline-content">
                        <strong className="ui-timeline-title">{item.titulo}</strong>
                        {item.organizacion && <span className="ui-timeline-org">{item.organizacion}</span>}
                        {formatDateRange(item) && <span className="ui-timeline-dates">{formatDateRange(item)}</span>}
                    </div>
                </li>
            ))}
        </ul>
    );
}
