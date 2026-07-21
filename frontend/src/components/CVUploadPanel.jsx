import React, { useState } from "react";
import { userService } from "../services/api";
import ProfileUpdateConfirmCard from "./ProfileUpdateConfirmCard";
import "./CVUploadPanel.css";

const ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
];

function isProposalEmpty(proposal) {
    const hasCandidateFields = Object.keys(proposal?.candidateFields || {}).length > 0;
    const hasSections = Object.values(proposal?.sections || {}).some((rows) => Array.isArray(rows) && rows.length > 0);
    return !hasCandidateFields && !hasSections;
}

/**
 * Sube un CV (PDF/DOCX/TXT) o texto pegado, lo manda a analizar con IA y
 * muestra la propuesta de campos de perfil para confirmar antes de guardar.
 * Reusado tanto en el chat propio (CandidateChatPage) como en el onboarding.
 */
export default function CVUploadPanel({ userId, onSaved }) {
    const [file, setFile] = useState(null);
    const [cvText, setCvText] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [proposal, setProposal] = useState(null);
    const [error, setError] = useState("");

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0] || null;
        setError("");
        if (selected && !ALLOWED_TYPES.includes(selected.type)) {
            setError("Formato no soportado. Subí un PDF, Word (.docx) o texto plano.");
            setFile(null);
            return;
        }
        setFile(selected);
    };

    const handleAnalyze = async () => {
        if (!file && !cvText.trim()) {
            setError("Subí un archivo o pegá el texto de tu CV.");
            return;
        }
        setAnalyzing(true);
        setError("");
        setProposal(null);
        try {
            const result = await userService.extractCV(userId, file ? { file } : { cvText: cvText.trim() });
            setProposal(result.proposal);
        } catch (err) {
            setError(err.message || "No se pudo analizar el CV. Probá de nuevo.");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSaved = () => {
        onSaved?.();
        setProposal(null);
        setFile(null);
        setCvText("");
    };

    return (
        <div className="cv-upload-panel">
            <p className="cv-upload-title">Subí tu CV y completo tu perfil automáticamente</p>

            <input
                type="file"
                accept={ALLOWED_TYPES.join(",")}
                onChange={handleFileChange}
                disabled={analyzing}
            />

            <p className="cv-upload-or">o pegá el texto directamente:</p>
            <textarea
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                placeholder="Pegá acá el texto de tu CV…"
                rows={4}
                disabled={analyzing || !!file}
            />

            {error && <p className="cv-upload-error">{error}</p>}

            <button className="cv-upload-analyze-btn" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? "Analizando…" : "Analizar CV"}
            </button>

            {proposal && (
                isProposalEmpty(proposal) ? (
                    <p className="cv-upload-empty-result">
                        No encontré datos nuevos para proponer — probá con otro archivo o pegando el texto directamente.
                    </p>
                ) : (
                    <ProfileUpdateConfirmCard
                        userId={userId}
                        proposal={proposal}
                        onSaved={handleSaved}
                        onDismiss={() => setProposal(null)}
                    />
                )
            )}
        </div>
    );
}
