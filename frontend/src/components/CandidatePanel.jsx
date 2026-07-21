import React from "react";
import { MapPin, Briefcase, GraduationCap, Globe, Sparkles } from "lucide-react";
import Chip from "./Chip";
import Timeline from "./Timeline";
import ScoreBar from "./ScoreBar";
import { avatarGradient } from "../utils/avatarColor";
import "./CandidatePanel.css";

function getInitials(name = "") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

/**
 * % de completitud del perfil — dato real calculado sobre los campos que
 * este mismo panel ya recibe (no es un "match" inventado). Mismo espíritu
 * que el checklist de ProfilePage.jsx, adaptado al shape normalizado del chat.
 */
function estimateCompletion(profile) {
    const checklist = [
        Boolean(profile.headline),
        Boolean(profile.summary),
        Boolean(profile.location),
        (profile.skills?.length || 0) > 0,
        (profile.experiences?.length || 0) > 0,
        (profile.studies?.length || 0) > 0,
        (profile.languages?.length || 0) > 0,
    ];
    const done = checklist.filter(Boolean).length;
    return Math.round((done / checklist.length) * 100);
}

/**
 * Panel de contexto permanente del candidato — foto/iniciales, cargo, skills,
 * experiencia y educación en timeline, idiomas. Usa el mismo shape normalizado
 * que ya arma profileNormalizers.js (normalizeCandidateProfile/normalizeOwnerProfile),
 * así que sirve tanto para "vista previa" (perfil del candidato) como para
 * "completar perfil" (el propio, mostrado como contexto en vivo).
 */
export default function CandidatePanel({ profile, photoUrl, loading }) {
    if (loading) {
        return (
            <aside className="candidate-panel">
                <div className="candidate-panel-header">
                    <div className="candidate-panel-avatar skeleton" />
                    <div className="skeleton candidate-panel-skeleton-line" style={{ width: "70%" }} />
                    <div className="skeleton candidate-panel-skeleton-line" style={{ width: "45%" }} />
                </div>
            </aside>
        );
    }

    if (!profile) return null;

    return (
        <aside className="candidate-panel">
            <div className="candidate-panel-header">
                <div className="candidate-panel-avatar" style={photoUrl ? undefined : { background: avatarGradient(profile.name) }}>
                    {photoUrl ? (
                        <img src={photoUrl} alt={profile.name} />
                    ) : (
                        <span>{getInitials(profile.name)}</span>
                    )}
                </div>
                <h2 className="candidate-panel-name">{profile.name}</h2>
                {profile.headline && <p className="candidate-panel-headline">{profile.headline}</p>}
                {profile.location && (
                    <p className="candidate-panel-location">
                        <MapPin size={13} strokeWidth={2} />
                        {profile.location}
                    </p>
                )}
            </div>

            <section className="candidate-panel-section candidate-panel-completion">
                <h3>Perfil completo</h3>
                <ScoreBar value={estimateCompletion(profile)} />
            </section>

            {profile.skills?.length > 0 && (
                <section className="candidate-panel-section">
                    <h3><Sparkles size={14} strokeWidth={2} /> Skills</h3>
                    <div className="candidate-panel-chips">
                        {profile.skills.map((skill) => <Chip key={skill.id}>{skill.titulo}</Chip>)}
                    </div>
                </section>
            )}

            {profile.experiences?.length > 0 && (
                <section className="candidate-panel-section">
                    <h3><Briefcase size={14} strokeWidth={2} /> Experiencia</h3>
                    <Timeline items={profile.experiences} />
                </section>
            )}

            {profile.studies?.length > 0 && (
                <section className="candidate-panel-section">
                    <h3><GraduationCap size={14} strokeWidth={2} /> Educación</h3>
                    <Timeline items={profile.studies} />
                </section>
            )}

            {profile.languages?.length > 0 && (
                <section className="candidate-panel-section">
                    <h3><Globe size={14} strokeWidth={2} /> Idiomas</h3>
                    <div className="candidate-panel-chips">
                        {profile.languages.map((lang) => (
                            <Chip key={lang.id}>{lang.nivel ? `${lang.titulo} · ${lang.nivel}` : lang.titulo}</Chip>
                        ))}
                    </div>
                </section>
            )}
        </aside>
    );
}
