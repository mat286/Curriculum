import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import CVModal from "../components/CVModal";
import { useAuth } from "../context/AuthContext";
import { candidateChatService, candidatesService, userService } from "../services/api";
import { normalizeCandidateProfile } from "../utils/profileNormalizers";
import "./CandidateChatPage.css";

const buildInitialMessage = (name = "este candidato", isOwnChat = false) => ({
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content: isOwnChat
        ? `Hola ${name}. Estoy listo para ayudarte a practicar entrevistas, resumir tu experiencia y mejorar cómo presentás tu perfil.`
        : `Hola. Soy el avatar de ${name}. Podés preguntarme sobre mi experiencia, habilidades, proyectos o forma de trabajo.`,
});

// Cuenta segundos mientras loading=true
function useElapsedSeconds(active) {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!active) { setElapsed(0); return; }
        setElapsed(0);
        const id = setInterval(() => setElapsed((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [active]);
    return elapsed;
}

export default function CandidateChatPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const [candidate, setCandidate] = useState(null);
    const [profileForCV, setProfileForCV] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [error, setError] = useState("");
    const [lastFailedMessage, setLastFailedMessage] = useState("");
    const [showCVModal, setShowCVModal] = useState(false);
    const elapsed = useElapsedSeconds(loading);

    const abortControllerRef = useRef(null);
    const tokenBufferRef = useRef("");
    const flushTimerRef = useRef(null);
    const threadRef = useRef(null);
    const retryTimeoutRef = useRef(null);

    const storageKey = useMemo(() => `cv-chat-history:candidate:${id}`, [id]);
    const currentUserId = user?.id || user?.userId || user?.googleId;
    const isOwnChat = String(currentUserId || "") === String(id || "");

    useEffect(() => {
        document.body.classList.add("chat-page-active");
        return () => document.body.classList.remove("chat-page-active");
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try { setMessages(JSON.parse(saved)); } catch { setMessages([]); }
        } else {
            setMessages([]);
        }
    }, [storageKey]);

    useEffect(() => {
        if (messages.length > 0) localStorage.setItem(storageKey, JSON.stringify(messages));
    }, [messages, storageKey]);

    useEffect(() => {
        if (threadRef.current) {
            threadRef.current.scrollTop = threadRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => () => {
        clearTimeout(flushTimerRef.current);
        clearTimeout(retryTimeoutRef.current);
        abortControllerRef.current?.abort();
    }, []);

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
    }, [id, isOwnChat]);

    const flushBuffer = useCallback((msgId) => {
        const chunk = tokenBufferRef.current;
        if (!chunk) return;
        tokenBufferRef.current = "";
        setMessages((cur) => cur.map((m) => m.id === msgId ? { ...m, content: m.content + chunk } : m));
    }, []);

    const scheduleFlush = useCallback((msgId) => {
        if (flushTimerRef.current) return;
        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null;
            flushBuffer(msgId);
            if (tokenBufferRef.current.length > 0) scheduleFlush(msgId);
        }, 45);
    }, [flushBuffer]);

    const finishStream = useCallback((msgId) => {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
        flushBuffer(msgId);
        setMessages((cur) => cur.map((m) => m.id === msgId ? { ...m, streaming: false } : m));
        setLoading(false);
    }, [flushBuffer]);

    const handleSend = async (override = "") => {
        const text = (override || input).trim();
        if (!text || loading) return;

        const streamingMsgId = `a-stream-${Date.now()}`;
        tokenBufferRef.current = "";

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setMessages((cur) => [
            ...cur,
            { id: `u-${Date.now()}`, role: "user", content: text },
            { id: streamingMsgId, role: "assistant", content: "", streaming: true },
        ]);
        if (!override) setInput("");
        setLoading(true);
        setError("");
        setLastFailedMessage("");

        await candidateChatService.askStream(
            id,
            text,
            (token) => {
                tokenBufferRef.current += token;
                scheduleFlush(streamingMsgId);
            },
            (err) => {
                finishStream(streamingMsgId);
                if (err?.name === "AbortError") {
                    setMessages((cur) => cur.map((m) =>
                        m.id === streamingMsgId && !m.content
                            ? { ...m, content: "Respuesta cancelada.", streaming: false }
                            : m
                    ));
                    return;
                }
                setMessages((cur) => cur.map((m) =>
                    m.id === streamingMsgId
                        ? { ...m, content: "No se pudo obtener respuesta. Intentalo de nuevo.", streaming: false }
                        : m
                ));
                setError("No se pudo obtener una respuesta.");
                setLastFailedMessage(text);
            },
            () => finishStream(streamingMsgId),
            { signal: controller.signal, onEvent: () => {} }
        ).catch((err) => {
            finishStream(streamingMsgId);
            setMessages((cur) => cur.map((m) =>
                m.id === streamingMsgId
                    ? { ...m, content: err.message || "Error inesperado.", streaming: false }
                    : m
            ));
            setError(err.message || "Error inesperado.");
            setLastFailedMessage(text);
        }).finally(() => {
            abortControllerRef.current = null;
        });
    };

    const handleCancel = () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    };

    const handleRetry = () => {
        if (!lastFailedMessage || loading) return;
        setError("");
        handleSend(lastFailedMessage);
    };

    const handleClear = () => {
        if (messages.length > 1 && !window.confirm("¿Borrar el historial de esta conversación?")) return;
        localStorage.removeItem(storageKey);
        setMessages([buildInitialMessage(candidate?.nombre, isOwnChat)]);
        setError("");
        setLastFailedMessage("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
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

                {/* Sidebar */}
                <aside className="candidate-chat-sidebar">
                    {loadingProfile ? (
                        <>
                            <div className="skeleton skeleton-pill" />
                            <div className="skeleton skeleton-title" />
                            <div className="skeleton skeleton-line" />
                            <div className="skeleton skeleton-line skeleton-line--short" />
                            <div className="skeleton skeleton-tags">
                                <div className="skeleton skeleton-tag" />
                                <div className="skeleton skeleton-tag" />
                                <div className="skeleton skeleton-tag" />
                            </div>
                        </>
                    ) : (
                        <>
                            <span className={`candidate-mode-pill ${isOwnChat ? "own" : "public"}`}>
                                {isOwnChat ? "Tu perfil" : "Candidato"}
                            </span>
                            <h1>{candidate?.nombre || "Sin nombre"}</h1>
                            {candidate?.puestoActual && <p className="candidate-chat-role">{candidate.puestoActual}</p>}
                            {candidate?.resumen && <p className="candidate-chat-summary">{candidate.resumen}</p>}
                            {candidate?.habilidades?.length > 0 && (
                                <div className="candidate-chat-tags">
                                    {candidate.habilidades.slice(0, 8).map((s) => <span key={s}>{s}</span>)}
                                </div>
                            )}
                            <div className="candidate-chat-links">
                                {isOwnChat
                                    ? <Link to="/perfil">Editar mi perfil</Link>
                                    : <Link to="/search">Ver más candidatos</Link>}
                                <Link to="/">Volver al inicio</Link>
                            </div>
                        </>
                    )}
                </aside>

                {/* Main */}
                <section className="candidate-chat-main">

                    {/* Topbar compacto */}
                    <div className="candidate-chat-topbar">
                        <div className="topbar-info">
                            <span className="topbar-name">
                                {candidate?.nombre || (loadingProfile ? "Cargando…" : "Chat")}
                            </span>
                            {loading ? (
                                <span className="topbar-status topbar-status--thinking">
                                    <span className="status-dot" />
                                    {elapsed < 4 ? "Procesando…" : `Procesando… ${elapsed}s`}
                                </span>
                            ) : (
                                <span className="topbar-status topbar-status--ready">En línea</span>
                            )}
                        </div>

                        <div className="topbar-actions">
                            <button className="btn-ghost" onClick={() => setShowCVModal(true)} title="Ver CV completo">
                                📄 CV
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
                            <button className="btn-ghost btn-ghost--subtle" onClick={handleClear} title="Borrar historial">
                                Limpiar
                            </button>
                        </div>
                    </div>

                    {/* Mensajes */}
                    <div className="candidate-chat-thread" ref={threadRef}>
                        {messages.map((msg) => (
                            <div key={msg.id} className={`candidate-bubble ${msg.role}`}>
                                {msg.streaming && !msg.content ? (
                                    <span className="candidate-loading-dots">
                                        <span /><span /><span />
                                    </span>
                                ) : (
                                    <>
                                        <span className="bubble-text">{msg.content}</span>
                                        {msg.streaming && <span className="candidate-stream-cursor" aria-hidden="true" />}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Error inline */}
                    {error && candidate && (
                        <div className="candidate-chat-error">
                            <span>{error}</span>
                            {lastFailedMessage && (
                                <button className="error-retry-btn" onClick={handleRetry}>Reintentar</button>
                            )}
                        </div>
                    )}

                    {/* Input */}
                    <div className="candidate-chat-input-row">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                isOwnChat
                                    ? "Escribí tu pregunta… (Enter para enviar)"
                                    : "Preguntá sobre experiencia, skills o proyectos… (Enter para enviar)"
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
                            {loading ? (
                                <span className="send-spinner" />
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            )}
                        </button>
                    </div>
                </section>
            </div>

            <CVModal isOpen={showCVModal} onClose={() => setShowCVModal(false)} profile={profileForCV} />
        </>
    );
}
