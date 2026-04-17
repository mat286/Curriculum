import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CVModal from "../components/CVModal";
import { useAuth } from "../context/AuthContext";
import { candidateChatService, candidatesService, userService } from "../services/api";
import "./CandidateChatPage.css";

const buildInitialMessage = (name = "este candidato", isOwnChat = false) => ({
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content: isOwnChat
        ? `Hola ${name}. Estoy listo para ayudarte a practicar entrevistas, resumir tu experiencia y mejorar cómo presentas tu perfil.`
        : `Hola. Soy el avatar de ${name}. Podés preguntarme sobre mi experiencia, skills, proyectos o forma de trabajo.`,
});

const toText = (value) => (value === null || typeof value === "undefined" ? "" : String(value));
const toBoolean = (value) => value === true || value === 1 || value === "1" || value === "true";

const normalizeRichItems = (items) => {
    if (!Array.isArray(items)) return [];

    return items
        .map((item, index) => {
            if (typeof item === "string") {
                return { id: `item-${index}`, titulo: item };
            }

            return {
                id: item?.id ?? `item-${index}`,
                titulo: toText(item?.titulo || item?.nombre || item?.idioma || item?.puesto || item?.empresa || item?.institucion),
                descripcion: toText(item?.descripcion || item?.detalle || item?.nivel || item?.categoria || item?.tecnologias),
                organizacion: toText(item?.organizacion || item?.empresa || item?.institucion || item?.entidad),
                ubicacion: toText(item?.ubicacion || item?.location),
                fechaInicio: toText(item?.fechaInicio || item?.fecha_inicio || item?.desde).slice(0, 7),
                fechaFin: toText(item?.fechaFin || item?.fecha_fin || item?.hasta).slice(0, 7),
                enCurso: toBoolean(item?.enCurso ?? item?.en_curso ?? item?.actual),
                enlace: toText(item?.enlace || item?.url || item?.link || item?.github || item?.demo_url),
                nivel: toText(item?.nivel || item?.level),
                categoria: toText(item?.categoria || item?.category),
                rol: toText(item?.rol),
            };
        })
        .filter((item) => item.titulo || item.descripcion);
};

const normalizeTagItems = (items) => {
    if (!Array.isArray(items)) return [];

    return items
        .map((item, index) => {
            if (typeof item === "string") {
                return { id: `tag-${index}`, titulo: item };
            }

            return {
                id: item?.id ?? `tag-${index}`,
                titulo: toText(item?.titulo || item?.nombre || item?.idioma || item?.skill || item?.habilidad),
                nivel: toText(item?.nivel || item?.level),
            };
        })
        .filter((item) => item.titulo);
};

const normalizeCandidateProfile = (candidate = {}, data = {}) => {
    const about = Array.isArray(data.sobre_mi) ? data.sobre_mi[0] || {} : data.sobre_mi || {};
    const fullName =
        toText(candidate.nombre) ||
        [data.usuario?.nombre, data.usuario?.apellido].filter(Boolean).join(" ").trim() ||
        "Candidato";

    return {
        name: fullName,
        headline: toText(candidate.puestoActual || data.usuario?.puesto_actual || data.usuario?.resumen || "Perfil conversacional activo"),
        summary: toText(
            candidate.resumen ||
            about.descripcion ||
            data.usuario?.objetivo_profesional ||
            data.usuario?.resumen ||
            "Perfil listo para conversar y ser evaluado por IA."
        ),
        location: toText(candidate.ubicacion || data.usuario?.direccion),
        availability: toText(data.usuario?.disponibilidad),
        preferredMode: toText(data.usuario?.modalidad_preferida),
        salary: toText(data.usuario?.pretension_salarial),
        linkedinUrl: toText(data.usuario?.linkedin_url || candidate.linkedin_url || candidate.linkedinUrl),
        githubUrl: toText(data.usuario?.github_url || candidate.github_url || candidate.githubUrl),
        portfolioUrl: toText(data.usuario?.portfolio_url || candidate.portfolio_url || candidate.portfolioUrl),
        experiences: normalizeRichItems(data.experiencia_laboral || candidate.experiencia_laboral || candidate.experiencias || []),
        projects: normalizeRichItems(data.proyectos || candidate.proyectos || candidate.projects || []),
        skills: normalizeTagItems(data.habilidades || candidate.habilidades || candidate.skills || []),
        studies: normalizeRichItems(data.educacion || candidate.estudios || candidate.educacion || []),
        languages: normalizeTagItems(data.idiomas || candidate.idiomas || candidate.languages || []),
    };
};

export default function CandidateChatPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const [candidate, setCandidate] = useState(null);
    const [profileForCV, setProfileForCV] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showCVModal, setShowCVModal] = useState(false);

    const storageKey = useMemo(() => `cv-chat-history:candidate:${id}`, [id]);
    const currentUserId = user?.id || user?.userId || user?.googleId;
    const isOwnChat = String(currentUserId || "") === String(id || "");

    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch {
                setMessages([]);
            }
        } else {
            setMessages([]);
        }
    }, [storageKey]);

    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(messages));
        }
    }, [messages, storageKey]);

    useEffect(() => {
        let mounted = true;

        const loadCandidate = async () => {
            setError("");

            try {
                const [publicCandidatesResult, detailedProfileResult] = await Promise.allSettled([
                    candidatesService.getAll(),
                    userService.getProfile(id),
                ]);

                const publicList = publicCandidatesResult.status === "fulfilled" ? publicCandidatesResult.value || [] : [];
                const foundCandidate = publicList.find((item) => String(item.id) === String(id));
                const detailedProfile = detailedProfileResult.status === "fulfilled" ? detailedProfileResult.value || {} : {};

                if (!mounted) return;

                if (!foundCandidate && !detailedProfile?.usuario && !detailedProfile?.sobre_mi) {
                    setError("Este candidato no está disponible públicamente.");
                    return;
                }

                const normalizedProfile = normalizeCandidateProfile(foundCandidate || {}, detailedProfile);

                setProfileForCV(normalizedProfile);
                setCandidate({
                    id,
                    nombre: normalizedProfile.name,
                    puestoActual: normalizedProfile.headline,
                    resumen: normalizedProfile.summary,
                    habilidades: (normalizedProfile.skills || []).map((item) => item.titulo).filter(Boolean),
                });
                setMessages((current) => (current.length > 0 ? current : [buildInitialMessage(normalizedProfile.name, isOwnChat)]));
            } catch {
                if (mounted) {
                    setError("No se pudo cargar el perfil del candidato.");
                }
            }
        };

        loadCandidate();

        return () => {
            mounted = false;
        };
    }, [id, isOwnChat]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMessage = { id: `u-${Date.now()}`, role: "user", content: text };
        setMessages((current) => [...current, userMessage]);
        setInput("");
        setLoading(true);
        setError("");

        try {
            const response = await candidateChatService.ask(id, text);
            setMessages((current) => [
                ...current,
                { id: `a-${Date.now()}`, role: "assistant", content: response.answer || "No pude responder en este momento." },
            ]);
        } catch (err) {
            setError(err.message || "No se pudo enviar el mensaje.");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    if (error && !candidate) {
        return (
            <div className="candidate-chat-page candidate-mode">
                <div className="candidate-chat-empty">
                    <h1>Perfil no disponible</h1>
                    <p>{error}</p>
                    <Link to="/" className="candidate-chat-link">Volver al inicio</Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={`candidate-chat-page ${isOwnChat ? "own-mode" : "candidate-mode"}`}>
                <aside className="candidate-chat-sidebar">
                    <span className={`candidate-mode-pill ${isOwnChat ? "own" : "public"}`}>
                        {isOwnChat ? "Tu chat personal" : "Candidato evaluado"}
                    </span>

                    <h1>{candidate?.nombre || "Cargando..."}</h1>
                    {candidate?.puestoActual && <p className="candidate-chat-role">{candidate.puestoActual}</p>}
                    {candidate?.resumen && <p className="candidate-chat-summary">{candidate.resumen}</p>}

                    <div className="candidate-chat-meta-row">
                        <span>{isOwnChat ? "Modo personal" : "Modo evaluación"}</span>
                        <span>Historial local</span>
                    </div>

                    {candidate?.habilidades?.length > 0 && (
                        <div className="candidate-chat-tags">
                            {candidate.habilidades.slice(0, 6).map((skill) => (
                                <span key={skill}>{skill}</span>
                            ))}
                        </div>
                    )}

                    <div className="candidate-chat-links">
                        {isOwnChat ? (
                            <Link to="/perfil">Editar mi perfil</Link>
                        ) : (
                            <Link to="/search">Buscar más candidatos</Link>
                        )}
                        <Link to="/">Volver al inicio</Link>
                    </div>
                </aside>

                <section className="candidate-chat-main">
                    <div className="candidate-chat-topbar">
                        <div>
                            <span className="candidate-chat-kicker">{isOwnChat ? "Chat personal" : "Entrevista de candidato"}</span>
                            <h2>{isOwnChat ? `Chat de ${candidate?.nombre || "tu perfil"}` : `Conversación con ${candidate?.nombre || "el candidato"}`}</h2>
                            <p>
                                {isOwnChat
                                    ? "Practica respuestas, revisa tu CV y mejora cómo te presentas en una entrevista."
                                    : "Consulta experiencia, skills y compatibilidad del perfil antes de tomar una decisión."}
                            </p>
                        </div>

                        <button type="button" className="candidate-cv-button" onClick={() => setShowCVModal(true)}>
                            📄 Ver CV
                        </button>
                    </div>

                    <div className="candidate-chat-thread">
                        {messages.map((message) => (
                            <div key={message.id} className={`candidate-bubble ${message.role}`}>
                                {message.content}
                            </div>
                        ))}
                        {loading && <div className="candidate-bubble assistant">Pensando respuesta…</div>}
                    </div>

                    {error && candidate && <div className="candidate-chat-error">{error}</div>}

                    <div className="candidate-chat-input-row">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                isOwnChat
                                    ? "Ej: resumime mi perfil para una entrevista laboral"
                                    : "Ej: ¿Tenés experiencia con Node.js y APIs REST?"
                            }
                            rows={3}
                        />
                        <button type="button" onClick={handleSend} disabled={loading || !input.trim()}>
                            {loading ? "Enviando..." : "Enviar"}
                        </button>
                    </div>
                </section>
            </div>

            <CVModal isOpen={showCVModal} onClose={() => setShowCVModal(false)} profile={profileForCV} />
        </>
    );
}
