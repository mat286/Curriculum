import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Plus, Eye, User, Home as HomeIcon, Send, Menu, PanelRight, FileUp } from "lucide-react";
import CVUploadPanel from "../components/CVUploadPanel";
import ProfileUpdateConfirmCard from "../components/ProfileUpdateConfirmCard";
import CandidatePanel from "../components/CandidatePanel";
import ThinkingIndicator from "../components/ThinkingIndicator";
import { useAuth } from "../context/AuthContext";
import { useStreamingChat } from "../hooks/useStreamingChat";
import { profileFillChatService, userService } from "../services/api";
import { normalizeOwnerProfile } from "../utils/profileNormalizers";
import "./CandidateChatPage.css";

const buildInitialMessage = (name = "") => ({
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content: `Hola${name ? " " + name : ""}. Contame sobre tu experiencia, estudios, habilidades o `
        + "idiomas y voy completando tu perfil — también podés subir tu CV desde el menú lateral.",
});

/**
 * Chat de "completar perfil" — distinto del de vista previa: acá la IA no
 * responde como si fuera el candidato ante un recruiter, sino que ayuda a
 * cargar datos del propio perfil (con confirmación antes de guardar) y
 * permite subir un CV para autocompletar. El panel derecho muestra el propio
 * perfil en vivo, para reforzar visualmente cómo se va completando.
 */
export default function ProfileFillChatPage() {
    const { user } = useAuth();
    const userId = user?.id || user?.userId || user?.googleId;
    const storageKey = useMemo(() => `cv-chat-history:profile-fill:${userId}`, [userId]);

    const [showCVUpload, setShowCVUpload] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [ownProfile, setOwnProfile] = useState(null);
    const [photoUrl, setPhotoUrl] = useState("");
    const [loadingProfile, setLoadingProfile] = useState(true);

    const loadOwnProfile = useCallback(async () => {
        if (!userId) return;
        try {
            const data = await userService.getProfile(userId);
            setOwnProfile(normalizeOwnerProfile(data, user));
            setPhotoUrl(data?.usuario?.profile_photo_url || "");
        } catch {
            // best-effort: si falla, el panel simplemente no muestra datos
        } finally {
            setLoadingProfile(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    useEffect(() => { loadOwnProfile(); }, [loadOwnProfile]);

    const handleEvent = useCallback((evt) => {
        if (!evt?.done || !evt?.proposedUpdate) return;
        const hasCandidateFields = Object.keys(evt.proposedUpdate.candidateFields || {}).length > 0;
        const hasSections = Object.values(evt.proposedUpdate.sections || {}).some((rows) => Array.isArray(rows) && rows.length > 0);
        if (!hasCandidateFields && !hasSections) return;

        setMessages((cur) => [
            ...cur,
            { id: `proposal-${Date.now()}`, role: "assistant", kind: "proposal", proposal: evt.proposedUpdate },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const {
        messages, setMessages, input, setInput, loading, error, lastFailedMessage,
        statusMessage, threadRef, handleSend, handleCancel, handleRetry, handleClear, handleKeyDown,
    } = useStreamingChat({ targetId: userId, storageKey, askStream: profileFillChatService.askStream, onEvent: handleEvent });

    useEffect(() => {
        setMessages((cur) => cur.length > 0 ? cur : [buildInitialMessage(user?.nombre)]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey]);

    return (
        <div className="candidate-chat-page fill-mode">

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

            {/* Sidebar */}
            <aside className={`candidate-chat-sidebar ${sidebarOpen ? "is-open" : ""}`}>
                <div className="candidate-chat-brand">
                    <Sparkles size={18} strokeWidth={2} />
                    CV Conversacional
                </div>

                <button
                    className="new-chat-btn"
                    onClick={() => handleClear(() => buildInitialMessage(user?.nombre))}
                >
                    <Plus size={16} strokeWidth={2} /> Nuevo chat
                </button>

                <button className="cv-upload-toggle-btn" onClick={() => setShowCVUpload((v) => !v)}>
                    <FileUp size={16} strokeWidth={2} />
                    {showCVUpload ? "Ocultar carga de CV" : "Cargar CV"}
                </button>
                {showCVUpload && (
                    <CVUploadPanel userId={userId} onSaved={() => { setShowCVUpload(false); loadOwnProfile(); }} />
                )}

                <div className="candidate-chat-links">
                    <Link to={`/${userId}`}><Eye size={14} strokeWidth={2} /> Ver vista previa</Link>
                    <Link to="/perfil"><User size={14} strokeWidth={2} /> Editar mi perfil</Link>
                    <Link to="/"><HomeIcon size={14} strokeWidth={2} /> Volver al inicio</Link>
                </div>
            </aside>

            {/* Main */}
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
                            <Sparkles size={16} strokeWidth={2} /> Completar mi perfil con IA
                        </span>
                        {(ownProfile?.headline || ownProfile?.availability) && (
                            <span className="topbar-context">
                                {[ownProfile?.headline, ownProfile?.availability].filter(Boolean).join(" · ")}
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
                            aria-label="Ver mi perfil"
                        >
                            <PanelRight size={18} strokeWidth={2} />
                        </button>
                    </div>
                </div>

                <div className="candidate-chat-thread" ref={threadRef}>
                    {messages.map((msg) => (
                        msg.kind === "proposal" ? (
                            <ProfileUpdateConfirmCard
                                key={msg.id}
                                userId={userId}
                                proposal={msg.proposal}
                                onSaved={() => { setMessages((cur) => cur.filter((m) => m.id !== msg.id)); loadOwnProfile(); }}
                                onDismiss={() => setMessages((cur) => cur.filter((m) => m.id !== msg.id))}
                            />
                        ) : msg.role === "assistant" ? (
                            <div key={msg.id} className="ai-response-card">
                                <div className="ai-response-card-header">
                                    <Sparkles size={13} strokeWidth={2.2} /> Asistente
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

                {error && (
                    <div className="candidate-chat-error">
                        <span className="candidate-chat-error-icon" aria-hidden="true">⚠️</span>
                        <span>{error}</span>
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
                        placeholder="Contame sobre tu experiencia, estudios o habilidades…"
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

            {/* Panel — tu propio perfil, en vivo */}
            <div className={`candidate-chat-candidate-panel ${panelOpen ? "is-open" : ""}`}>
                <CandidatePanel profile={ownProfile} photoUrl={photoUrl} loading={loadingProfile} />
            </div>
        </div>
    );
}
