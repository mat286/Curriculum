import React, { useMemo, useState } from "react";
import { userService } from "../services/api";
import "./ProfileUpdateConfirmCard.css";

const SECTION_LABELS = {
    experiencia_laboral: "Experiencia laboral",
    educacion: "Educación",
    cursos: "Cursos",
    proyectos: "Proyectos",
    habilidades: "Habilidades",
    idiomas: "Idiomas",
};

const CANDIDATE_FIELD_LABELS = {
    nombre: "Nombre",
    puestoActual: "Puesto actual",
    resumen: "Resumen",
    objetivoProfesional: "Objetivo profesional",
    disponibilidad: "Disponibilidad",
    modalidadPreferida: "Modalidad preferida",
    pretensionSalarial: "Pretensión salarial",
    linkedinUrl: "LinkedIn",
    githubUrl: "GitHub",
    portfolioUrl: "Portfolio",
    sobreMi: "Sobre mí",
};

function describeSectionItem(sectionKey, item) {
    switch (sectionKey) {
    case "experiencia_laboral":
        return `${item.puesto || "?"} en ${item.empresa || "?"}`;
    case "educacion":
        return `${item.titulo || "?"} — ${item.institucion || "?"}`;
    case "cursos":
        return item.institucion ? `${item.nombre} (${item.institucion})` : item.nombre;
    case "proyectos":
        return item.nombre;
    case "habilidades":
        return item.nivel ? `${item.nombre} (${item.nivel})` : item.nombre;
    case "idiomas":
        return item.nivel ? `${item.idioma} (${item.nivel})` : item.idioma;
    default:
        return JSON.stringify(item);
    }
}

function isProposalEmpty(proposal) {
    const hasCandidateFields = Object.keys(proposal?.candidateFields || {}).length > 0;
    const hasSections = Object.values(proposal?.sections || {}).some((rows) => Array.isArray(rows) && rows.length > 0);
    return !hasCandidateFields && !hasSections;
}

/**
 * Muestra una propuesta de actualización de perfil (extraída por IA, del chat
 * de autocompletado o de un CV) y deja confirmarla o descartarla antes de
 * escribir nada en la base de datos.
 */
export default function ProfileUpdateConfirmCard({ userId, proposal, onSaved, onDismiss }) {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    const candidateFieldEntries = useMemo(
        () => Object.entries(proposal?.candidateFields || {}),
        [proposal],
    );
    const sectionEntries = useMemo(
        () => Object.entries(proposal?.sections || {}).filter(([, rows]) => Array.isArray(rows) && rows.length > 0),
        [proposal],
    );

    if (isProposalEmpty(proposal)) return null;
    if (saved) {
        return (
            <div className="profile-update-card profile-update-card--saved">
                <span>✓ Guardado en tu perfil</span>
            </div>
        );
    }

    const handleConfirm = async () => {
        setSaving(true);
        setError("");
        try {
            const sections = sectionEntries.flatMap(([sectionKey, rows]) =>
                rows.map((payload) => ({ sectionKey, action: "create", payload })));
            const basicFields = candidateFieldEntries.length > 0
                ? Object.fromEntries(candidateFieldEntries)
                : undefined;

            await userService.confirmProfileUpdates(userId, { basicFields, sections });
            setSaved(true);
            onSaved?.(proposal);
        } catch (err) {
            setError(err.message || "No se pudo guardar. Probá de nuevo.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="profile-update-card">
            <p className="profile-update-card-title">Encontré esto en tu perfil, ¿lo guardo?</p>

            <div className="profile-update-card-body">
                {candidateFieldEntries.length > 0 && (
                    <ul className="profile-update-list">
                        {candidateFieldEntries.map(([key, value]) => (
                            <li key={key}>
                                <strong>{CANDIDATE_FIELD_LABELS[key] || key}:</strong> {value}
                            </li>
                        ))}
                    </ul>
                )}
                {sectionEntries.map(([sectionKey, rows]) => (
                    <div key={sectionKey} className="profile-update-section">
                        <span className="profile-update-section-label">{SECTION_LABELS[sectionKey] || sectionKey}</span>
                        <ul className="profile-update-list">
                            {rows.map((item, idx) => (
                                <li key={idx}>{describeSectionItem(sectionKey, item)}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {error && <p className="profile-update-card-error">{error}</p>}

            <div className="profile-update-card-actions">
                <button className="profile-update-btn profile-update-btn--ghost" onClick={onDismiss} disabled={saving}>
                    Descartar
                </button>
                <button className="profile-update-btn profile-update-btn--primary" onClick={handleConfirm} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar en mi perfil"}
                </button>
            </div>
        </div>
    );
}
