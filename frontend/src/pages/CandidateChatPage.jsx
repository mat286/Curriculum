import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CVModal from "../components/CVModal";
import { useAuth } from "../context/AuthContext";
import { candidateChatService, candidatesService, userService } from "../services/api";
import { useStreamMetrics } from "../hooks/useStreamMetrics";
import StreamingIndicator from "../components/StreamingIndicator";
import { toText, toBoolean, normalizeProfileItems as normalizeRichItems } from "../utils/profileNormalizers";
import "./CandidateChatPage.css";

const buildInitialMessage = (name = "este candidato", isOwnChat = false) => ({
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content: isOwnChat
        ? `Hola ${name}. Estoy listo para ayudarte a practicar entrevistas, resumir tu experiencia y mejorar cómo presentas tu perfil.`
        : `Hola. Soy el avatar de ${name}. Podés preguntarme sobre mi experiencia, skills, proyectos o forma de trabajo.`,
});

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

const STREAM_STATUS_LABELS = {
    thinking: "Pensando",
    retrieving: "Recuperando contexto",
    generating: "Generando respuesta",
    finalizing: "Finalizando",
};

const normalizeStreamStatus = (value) => {
    const text = toText(value).toLowerCase();
    if (["thinking", "retrieving", "generating", "finalizing"].includes(text)) {
        return text;
    }
    return "";
};

const roundMs = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed);
};

export default function CandidateChatPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const { metrics, handleStreamEvent, reset: resetMetrics } = useStreamMetrics();
    const [candidate, setCandidate] = useState(null);
    const [profileForCV, setProfileForCV] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [streamStatus, setStreamStatus] = useState("thinking");
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [error, setError] = useState("");
    const [lastFailedMessage, setLastFailedMessage] = useState("");
    const [showCVModal, setShowCVModal] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [streamMetrics, setStreamMetrics] = useState({
        requestId: "",
        routed: "",
        cached: false,
        backendTtfbMs: null,
        frontendTtfbMs: null,
        totalMs: null,
        semanticMs: null,
        promptChars: null,
    });

    const abortControllerRef = useRef(null);
    const tokenBufferRef = useRef("");
    const flushTimerRef = useRef(null);
    const activeStreamingMsgIdRef = useRef("");
    const streamPerfRef = useRef({ startedAt: 0, firstTokenAt: 0, requestId: "" });
    const retryTimeoutRef = useRef(null);

    const storageKey = useMemo(() => `cv-chat-history:candidate:${id}`, [id]);
    const currentUserId = user?.id || user?.userId || user?.googleId;
    const isOwnChat = String(currentUserId || "") === String(id || "");

    // Bloquea el scroll de la página y oculta el footer mientras el chat está activo
    useEffect(() => {
        document.body.classList.add("chat-page-active");
        return () => document.body.classList.remove("chat-page-active");
    }, []);

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
        return () => {
            if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadCandidate = async () => {
            setError("");
            setLoadingProfile(true);

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
            } finally {
                if (mounted) setLoadingProfile(false);
            }
        };

        loadCandidate();

        return () => {
            mounted = false;
        };
    }, [id, isOwnChat]);

    const flushBufferedTokens = useCallback((streamingMsgId) => {
        const chunk = tokenBufferRef.current;
        if (!chunk) return;

        tokenBufferRef.current = "";
        setMessages((current) =>
            current.map((m) => (m.id === streamingMsgId ? { ...m, content: m.content + chunk } : m))
        );
    }, []);

    const scheduleTokenFlush = useCallback((streamingMsgId) => {
        if (flushTimerRef.current) return;

        const bufferSize = tokenBufferRef.current.length;
        const delay = bufferSize > 80 ? 40 : bufferSize > 20 ? 50 : 60;

        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null;
            flushBufferedTokens(streamingMsgId);
            if (tokenBufferRef.current.length > 0) {
                scheduleTokenFlush(streamingMsgId);
            }
        }, delay);
    }, [flushBufferedTokens]);

    const finishStreamingMessage = useCallback((streamingMsgId, options = {}) => {
        const { keepLoading = false, status = "thinking" } = options;

        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }

        flushBufferedTokens(streamingMsgId);
        activeStreamingMsgIdRef.current = "";

        setMessages((current) =>
            current.map((m) => (m.id === streamingMsgId ? { ...m, streaming: false } : m))
        );

        setStreamStatus(status);
        if (!keepLoading) setLoading(false);
    }, [flushBufferedTokens]);

    const applyStreamEventStatus = useCallback((eventPayload) => {
        const explicitStatus = normalizeStreamStatus(
            eventPayload?.status || eventPayload?.phase || eventPayload?.payload?.status || eventPayload?.payload?.phase
        );
        if (explicitStatus) {
            setStreamStatus(explicitStatus);
            return;
        }

        const eventType = toText(eventPayload?.eventType || eventPayload?.type).toLowerCase();
        if (eventType === "ack") {
            setStreamStatus("thinking");
            return;
        }

        if (eventType === "status") {
            const fallbackStatus = normalizeStreamStatus(eventPayload?.value || eventPayload?.name);
            if (fallbackStatus) setStreamStatus(fallbackStatus);
        }
    }, []);

    const handleSend = async (messageOverride = "") => {
        const text = (messageOverride || input).trim();
        if (!text || loading) return;

        const streamingMsgId = `a-stream-${Date.now()}`;
        activeStreamingMsgIdRef.current = streamingMsgId;
        tokenBufferRef.current = "";
        streamPerfRef.current = { startedAt: Date.now(), firstTokenAt: 0, requestId: "" };

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setMessages((current) => [
            ...current,
            { id: `u-${Date.now()}`, role: "user", content: text },
            { id: streamingMsgId, role: "assistant", content: "", streaming: true },
        ]);
        if (!messageOverride) setInput("");
        setLoading(true);
        setStreamStatus("thinking");
        setError("");
        setLastFailedMessage("");
        setRetryCount(0);
        resetMetrics();
        setStreamMetrics({
            requestId: "",
            routed: "",
            cached: false,
            backendTtfbMs: null,
            frontendTtfbMs: null,
            totalMs: null,
            semanticMs: null,
            promptChars: null,
        });

        await candidateChatService.askStream(
            id,
            text,
            // onToken
            (token) => {
                if (!streamPerfRef.current.firstTokenAt) {
                    const firstTokenAt = Date.now();
                    streamPerfRef.current.firstTokenAt = firstTokenAt;
                    const frontendTtfbMs = roundMs(firstTokenAt - streamPerfRef.current.startedAt);
                    setStreamMetrics((current) => ({ ...current, frontendTtfbMs }));
                }
                tokenBufferRef.current += token;
                setStreamStatus("generating");
                scheduleTokenFlush(streamingMsgId);
            },
            // onError
            (err) => {
                const isAbort = err?.name === "AbortError";
                finishStreamingMessage(streamingMsgId);

                if (isAbort) {
                    setMessages((current) =>
                        current.map((m) =>
                            m.id === streamingMsgId && !m.content
                                ? { ...m, content: "Generación cancelada.", streaming: false }
                                : m
                        )
                    );
                    setError("");
                    return;
                }

                setMessages((current) =>
                    current.map((m) =>
                        m.id === streamingMsgId
                            ? { ...m, content: err.message || "No se pudo responder en este momento.", streaming: false }
                            : m
                    )
                );
                setError(err.message || "No se pudo enviar el mensaje.");
                setLastFailedMessage(text);
            },
            // onDone
            () => {
                setStreamStatus("finalizing");
                finishStreamingMessage(streamingMsgId, { status: "thinking" });
            },
            {
                signal: controller.signal,
                onEvent: (eventPayload) => {
                    // Delegar al hook de métricas
                    handleStreamEvent(eventPayload);
                    
                    applyStreamEventStatus(eventPayload);

                    const eventType = toText(eventPayload?.eventType || eventPayload?.type).toLowerCase();
                    const payload = eventPayload?.payload && typeof eventPayload.payload === "object" ? eventPayload.payload : {};
                    const requestId = toText(eventPayload?.requestId || payload.requestId);

                    if (eventType === "ack" && requestId) {
                        streamPerfRef.current.requestId = requestId;
                        setStreamMetrics((current) => ({ ...current, requestId }));
                        return;
                    }

                    if (eventType === "metrics") {
                        setStreamMetrics((current) => ({
                            ...current,
                            requestId: requestId || current.requestId || streamPerfRef.current.requestId,
                            routed: toText(payload.routed || eventPayload?.routed || current.routed),
                            cached: payload.cached ?? eventPayload?.cached ?? current.cached,
                            backendTtfbMs: roundMs(payload.ttfbMs ?? eventPayload?.ttfbMs) ?? current.backendTtfbMs,
                            totalMs: roundMs(payload.totalMs ?? eventPayload?.totalMs) ?? current.totalMs,
                            semanticMs: roundMs(payload.semanticMs ?? eventPayload?.semanticMs) ?? current.semanticMs,
                            promptChars: Number.isFinite(Number(payload.promptChars ?? eventPayload?.promptChars))
                                ? Number(payload.promptChars ?? eventPayload?.promptChars)
                                : current.promptChars,
                        }));
                    }
                },
            }
        ).catch((unexpectedErr) => {
            finishStreamingMessage(streamingMsgId);
            setMessages((current) =>
                current.map((m) =>
                    m.id === streamingMsgId
                        ? { ...m, content: unexpectedErr.message || "Error inesperado.", streaming: false }
                        : m
                )
            );
            setError(unexpectedErr.message || "Error inesperado.");
            setLastFailedMessage(text);
        }).finally(() => {
            abortControllerRef.current = null;
        });
    };

    const handleCancelStreaming = () => {
        if (!loading || !abortControllerRef.current) return;
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    };

    const handleRetryLastMessage = () => {
        if (!lastFailedMessage || loading) return;

        // Exponential backoff: 1s, 2s, 4s
        const backoffDelays = [1000, 2000, 4000];
        const delay = backoffDelays[Math.min(retryCount, backoffDelays.length - 1)];

        setError(`Reintentando en ${Math.round(delay / 1000)}s...`);

        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
        }

        retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null;
            setRetryCount((prev) => prev + 1);
            handleSend(lastFailedMessage);
        }, delay);
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const handleClearHistory = () => {
        if (messages.length > 1 && !window.confirm("¿Querés borrar el historial de esta conversación?")) return;
        localStorage.removeItem(storageKey);
        setMessages([buildInitialMessage(candidate?.nombre, isOwnChat)]);
        setError("");
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
                        {isOwnChat ? "Tu chat personal" : "Candidato evaluado"}
                    </span>

                    <h1>{candidate?.nombre || "Sin nombre"}</h1>
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
                        </>
                    )}
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
                            
                            {/* StreamingIndicator integrado */}
                            {loading && (
                                <StreamingIndicator
                                    status={metrics.status}
                                    ttft={metrics.ttft}
                                    thinkingMs={metrics.thinkingMs}
                                    errorMessage={metrics.errorMessage}
                                    onRetry={handleRetryLastMessage}
                                />
                            )}

                            {(streamMetrics.requestId || streamMetrics.totalMs || streamMetrics.backendTtfbMs || streamMetrics.frontendTtfbMs) && (
                                <div className="candidate-stream-metrics">
                                    {streamMetrics.requestId && <span className="candidate-stream-metric">req: {streamMetrics.requestId.slice(0, 8)}</span>}
                                    {streamMetrics.frontendTtfbMs !== null && <span className="candidate-stream-metric">TTFT UX: {streamMetrics.frontendTtfbMs}ms</span>}
                                    {streamMetrics.backendTtfbMs !== null && <span className="candidate-stream-metric">TTFB BE: {streamMetrics.backendTtfbMs}ms</span>}
                                    {streamMetrics.totalMs !== null && <span className="candidate-stream-metric">Total: {streamMetrics.totalMs}ms</span>}
                                    {streamMetrics.routed && <span className="candidate-stream-metric">route: {streamMetrics.routed}</span>}
                                    {streamMetrics.cached ? <span className="candidate-stream-metric">cache: hit</span> : null}
                                </div>
                            )}
                        </div>

                        <div className="candidate-chat-topbar-actions">
                            <button type="button" className="candidate-cv-button" onClick={() => setShowCVModal(true)}>
                                📄 Ver CV
                            </button>
                            {loading ? (
                                <button
                                    type="button"
                                    className="candidate-cancel-button"
                                    onClick={handleCancelStreaming}
                                    title="Cancelar respuesta en curso"
                                >
                                    Cancelar
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="candidate-retry-button"
                                    onClick={handleRetryLastMessage}
                                    disabled={!lastFailedMessage}
                                    title="Reintentar último mensaje"
                                >
                                    Reintentar
                                </button>
                            )}
                            <button type="button" className="candidate-clear-button" onClick={handleClearHistory} title="Limpiar historial">
                                ↺ Limpiar
                            </button>
                        </div>
                    </div>

                    <div className="candidate-chat-thread">
                        {messages.map((message) => (
                            <div key={message.id} className={`candidate-bubble ${message.role}`}>
                                {message.streaming && !message.content ? (
                                    <span className="candidate-loading-dots">
                                        <span></span><span></span><span></span>
                                    </span>
                                ) : (
                                    <>
                                        {message.content}
                                        {message.streaming && <span className="candidate-stream-cursor" aria-hidden="true" />}
                                    </>
                                )}
                            </div>
                        ))}
                        {loading && messages.every((m) => !m.streaming) && (
                            <div className="candidate-bubble assistant">
                                <span className="candidate-loading-dots">
                                    <span></span><span></span><span></span>
                                </span>
                            </div>
                        )}
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
