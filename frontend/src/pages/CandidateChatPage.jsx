import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Sparkles, Plus, PenSquare, User, Search, Home as HomeIcon, Send, Menu, PanelRight, FileText } from "lucide-react";
import CVModal from "../components/CVModal";
import MyConversationsList from "../components/MyConversationsList";
import CandidatePanel from "../components/CandidatePanel";
import ThinkingIndicator from "../components/ThinkingIndicator";
import { useAuth } from "../context/AuthContext";
import { useStreamingChat } from "../hooks/useStreamingChat";
import { candidateChatService, candidatesService, userService } from "../services/api";
import { normalizeCandidateProfile } from "../utils/profileNormalizers";
import "./CandidateChatPage.css";

const buildInitialMessage = (name = "este candidato", isOwnChat = false) => ({
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content: isOwnChat
        ? `Hola ${name}. Este es tu chat de vista previa: así le respondo a un recruiter que pregunte sobre vos. Para completar o corregir tu perfil con IA, usá "Completar perfil" en el menú.`
        : `Hola. Soy el avatar de ${name}. Podés preguntarme sobre mi experiencia, habilidades, proyectos o forma de trabajo.`,
});

/**
 * Chat de "vista previa" — cómo le responde tu IA a un tercero. Se usa tanto
 * para el dueño del perfil (probando su propio avatar) como para visitantes
 * reales; en ambos casos pasa por el mismo motor RAG (ChatOrchestrator), a
 * propósito: el dueño tiene que ver exactamente lo que ve un recruiter.
 */
export default function CandidateChatPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const [candidate, setCandidate] = useState(null);
    const [profileForCV, setProfileForCV] = useState(null);
    const [photoUrl, setPhotoUrl] = useState("");
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [error, setError] = useState("");
    const [showCVModal, setShowCVModal] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);

    const storageKey = useMemo(() => `cv-chat-history:candidate:${id}`, [id]);
    const currentUserId = user?.id || user?.userId || user?.googleId;
    const isOwnChat = String(currentUserId || "") === String(id || "");

    const {
        messages, setMessages, input, setInput, loading, error: chatError, lastFailedMessage,
        statusMessage, threadRef, handleSend, handleCancel, handleRetry, handleClear, handleKeyDown,
    } = useStreamingChat({ targetId: id, storageKey, askStream: candidateChatService.askStream });

    useEffect(() => {
        document.body.classList.add("chat-page-active");
        return () => document.body.classList.remove("chat-page-active");
    }, []);

    useEffect(() => { setSidebarOpen(false); setPanelOpen(false); }, [id]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setError("");
            setLoadingProfile(true);
            try {
                const [publicResult, detailedResult] = await Promise.allSettled([
                    candidatesService.getAll(),
                    userService.getProfile(id),
                ]);
                if (!mounted) return;
                const publicList = publicResult.status === "fulfilled" ? publicResult.value || [] : [];
                const found = publicList.find((item) => String(item.id) === String(id));
                const detailed = detailedResult.status === "fulfilled" ? detailedResult.value || {} : {};

                if (!found && !detailed?.usuario && !detailed?.sobre_mi) {
                    setError("Este candidato no está disponible públicamente.");
                    return;
                }

                const norm = normalizeCandidateProfile(found || {}, detailed);
                setProfileForCV(norm);
                setPhotoUrl(detailed?.usuario?.profile_photo_url || "");
                setCandidate({
                    id,
                    nombre: norm.name,
                    puestoActual: norm.headline,
                    resumen: norm.summary,
                    habilidades: (norm.skills || []).map((s) => s.titulo).filter(Boolean),
                });
                setMessages((cur) => cur.length > 0 ? cur : [buildInitialMessage(norm.name, isOwnChat)]);
            } catch {
                if (mounted) setError("No se pudo cargar el perfil del candidato.");
            } finally {
                if (mounted) setLoadingProfile(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [id, isOwnChat, setMessages]);

    const displayError = error || chatError;

    if (displayError && !candidate) {
        return (
            <div className="candidate-chat-page candidate-mode">
                <div className="candidate-chat-empty">
                    <h1>Perfil no disponible</h1>
                    <p>{displayError}</p>
                    <Link to="/" className="candidate-chat-link">Volver al inicio</Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={`candidate-chat-page ${isOwnChat ? "own-mode" : "candidate-mode"}`}>

                <div
                    className={`candidate-chat-sidebar-backdrop ${sidebarOpen ? "is-open" : ""}`}
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
                <div
                    className={`candidate-chat-panel-backdrop ${panelOpen ? "is-open" : ""}`}
                    onClick={() => setPanelOpen(false)}
                    aria-hidden="true"
                />

                {/* Sidebar — estilo ChatGPT: logo, nuevo chat, historial */}
                <aside className={`candidate-chat-sidebar ${sidebarOpen ? "is-open" : ""}`}>
                    <div className="candidate-chat-brand">
                        <Sparkles size={18} strokeWidth={2} />
                        CV Conversacional
                    </div>

                    <button
                        className="new-chat-btn"
                        onClick={() => handleClear(() => buildInitialMessage(candidate?.nombre, isOwnChat))}
                    >
                        <Plus size={16} strokeWidth={2} /> Nuevo chat
                    </button>

                    {isOwnChat && (
                        <Link to="/mi-ia/completar" className="cv-upload-toggle-btn">
                            <PenSquare size={16} strokeWidth={2} /> Completar mi perfil con IA
                        </Link>
                    )}

                    <p className="candidate-chat-sidebar-heading">Historial</p>
                    <MyConversationsList />

                    <div className="candidate-chat-links">
                        {isOwnChat ? (
                            <Link to="/perfil"><User size={14} strokeWidth={2} /> Editar mi perfil</Link>
                        ) : (
                            <Link to="/search"><Search size={14} strokeWidth={2} /> Ver más candidatos</Link>
                        )}
                        <Link to="/"><HomeIcon size={14} strokeWidth={2} /> Volver al inicio</Link>
                    </div>
                </aside>

                {/* Main — chat */}
                <section className="candidate-chat-main">

                    <div className="candidate-chat-topbar">
                        <button
                            type="button"
                            className="mobile-sidebar-toggle"
                            onClick={() => setSidebarOpen((v) => !v)}
                            aria-label="Abrir menú lateral"
                        >
                            <Menu size={18} strokeWidth={2} />
                        </button>
                        <div className="topbar-info">
                            <span className="topbar-name">
                                {candidate?.nombre || (loadingProfile ? "Cargando…" : "Chat")}
                            </span>
                            {(candidate?.puestoActual || profileForCV?.availability) && (
                                <span className="topbar-context">
                                    {[candidate?.puestoActual, profileForCV?.availability].filter(Boolean).join(" · ")}
                                </span>
                            )}
                            {loading ? (
                                <span className="topbar-status topbar-status--thinking">
                                    <span className="status-dot" />
                                    Procesando…
                                </span>
                            ) : (
                                <span className="topbar-status topbar-status--ready">En línea</span>
                            )}
                        </div>

                        <div className="topbar-actions">
                            <button className="btn-ghost" onClick={() => setShowCVModal(true)} title="Ver CV completo">
                                <FileText size={15} strokeWidth={2} /> CV
                            </button>
                            {loading ? (
                                <button className="btn-danger" onClick={handleCancel}>
                                    Cancelar
                                </button>
                            ) : (
                                lastFailedMessage && (
                                    <button className="btn-secondary" onClick={handleRetry}>
                                        Reintentar
                                    </button>
                                )
                            )}
                            <button
                                type="button"
                                className="mobile-panel-toggle"
                                onClick={() => setPanelOpen((v) => !v)}
                                aria-label="Ver perfil del candidato"
                            >
                                <PanelRight size={18} strokeWidth={2} />
                            </button>
                        </div>
                    </div>

                    <div className="candidate-chat-thread" ref={threadRef}>
                        {messages.map((msg) => (
                            msg.role === "assistant" ? (
                                <div key={msg.id} className="ai-response-card">
                                    <div className="ai-response-card-header">
                                        <Sparkles size={13} strokeWidth={2.2} />
                                        IA · {candidate?.nombre || "Candidato"}
                                    </div>
                                    {msg.streaming && !msg.content ? (
                                        statusMessage ? <ThinkingIndicator label={statusMessage} /> : (
                                            <span className="candidate-loading-dots">
                                                <span /><span /><span />
                                            </span>
                                        )
                                    ) : (
                                        <>
                                            <span className="bubble-text">{msg.content}</span>
                                            {msg.streaming && <span className="candidate-stream-cursor" aria-hidden="true" />}
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div key={msg.id} className="candidate-bubble user">
                                    <span className="bubble-text">{msg.content}</span>
                                </div>
                            )
                        ))}
                    </div>

                    {chatError && candidate && (
                        <div className="candidate-chat-error">
                            <span className="candidate-chat-error-icon" aria-hidden="true">⚠️</span>
                            <span>{chatError}</span>
                            {lastFailedMessage && (
                                <button className="error-retry-btn" onClick={handleRetry}>Reintentar</button>
                            )}
                        </div>
                    )}

                    <div className="candidate-chat-input-row">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                isOwnChat
                                    ? "Escribí una pregunta como lo haría un recruiter…"
                                    : "Preguntale cualquier cosa sobre el candidato…"
                            }
                            rows={2}
                            disabled={loading}
                        />
                        <button
                            className="btn-send"
                            onClick={() => handleSend()}
                            disabled={loading || !input.trim()}
                            title="Enviar (Enter)"
                        >
                            {loading ? <span className="send-spinner" /> : <Send size={18} strokeWidth={2} />}
                        </button>
                    </div>
                </section>

                {/* Panel candidato — contexto permanente, 30% */}
                <div className={`candidate-chat-candidate-panel ${panelOpen ? "is-open" : ""}`}>
                    <CandidatePanel profile={profileForCV} photoUrl={photoUrl} loading={loadingProfile} />
                </div>
            </div>

            <CVModal isOpen={showCVModal} onClose={() => setShowCVModal(false)} profile={profileForCV} />
        </>
    );
}
