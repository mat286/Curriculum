import { useCallback, useEffect, useRef, useState } from "react";

// Mapea las fases que ya manda el backend por SSE (StreamResponse.js `sendStatus`)
// a un texto legible — así el frontend "muestra el proceso" en vez de solo esperar.
const STATUS_LABELS = {
    thinking: "Analizando tu pregunta...",
    retrieving: "Buscando información relacionada...",
    generating: "Generando respuesta...",
    finalizing: "Casi listo...",
};

// Cuenta segundos mientras `active` es true — usado para el indicador "Procesando… Ns".
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

/**
 * Lógica de chat con streaming SSE compartida entre CandidateChatPage (vista previa)
 * y ProfileFillChatPage (completar perfil con IA) — buffer/flush de tokens, historial
 * persistido en localStorage, cancelar/reintentar, y el estado de "procesando…".
 *
 * @param {string} targetId - id que se le pasa como primer argumento a askStream (candidateId o userId).
 * @param {string} storageKey - clave de localStorage para el historial de esta conversación.
 * @param {Function} askStream - candidateChatService.askStream o profileFillChatService.askStream.
 * @param {Function} [onEvent] - callback opcional para eventos SSE crudos (ej. capturar proposedUpdate).
 */
export function useStreamingChat({ targetId, storageKey, askStream, onEvent }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastFailedMessage, setLastFailedMessage] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const elapsed = useElapsedSeconds(loading);

    const abortControllerRef = useRef(null);
    const tokenBufferRef = useRef("");
    const flushTimerRef = useRef(null);
    const threadRef = useRef(null);

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
        abortControllerRef.current?.abort();
    }, []);

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
        setStatusMessage("");
    }, [flushBuffer]);

    // Envuelve el onEvent del caller: además de reenviarlo, traduce las fases
    // ("thinking"/"retrieving"/"generating"/"finalizing") a un label legible.
    const handleInternalEvent = useCallback((evt) => {
        if (evt?.eventType === "status" && evt?.payload?.status) {
            setStatusMessage(evt.payload.label || STATUS_LABELS[evt.payload.status] || "");
        }
        if (evt?.eventType === "token" && evt?.payload?.text) {
            setStatusMessage("");
        }
        onEvent?.(evt);
    }, [onEvent]);

    const handleSend = useCallback(async (override = "") => {
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
        setStatusMessage("");

        await askStream(
            targetId,
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
                const message = err?.message || "No se pudo obtener respuesta. Intentalo de nuevo.";
                setMessages((cur) => cur.map((m) =>
                    m.id === streamingMsgId
                        ? { ...m, content: message, streaming: false }
                        : m
                ));
                setError(message);
                setLastFailedMessage(text);
            },
            () => finishStream(streamingMsgId),
            { signal: controller.signal, onEvent: handleInternalEvent }
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
    }, [input, loading, askStream, targetId, handleInternalEvent, scheduleFlush, finishStream]);

    const handleCancel = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    }, []);

    const handleRetry = useCallback(() => {
        if (!lastFailedMessage || loading) return;
        setError("");
        handleSend(lastFailedMessage);
    }, [lastFailedMessage, loading, handleSend]);

    const handleClear = useCallback((buildInitialMessage, confirmMessage = "¿Borrar el historial de esta conversación?") => {
        if (messages.length > 1 && !window.confirm(confirmMessage)) return;
        localStorage.removeItem(storageKey);
        setMessages([buildInitialMessage()]);
        setError("");
        setLastFailedMessage("");
    }, [messages.length, storageKey]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    }, [handleSend]);

    return {
        messages, setMessages, input, setInput, loading, error, lastFailedMessage, elapsed,
        statusMessage, threadRef, handleSend, handleCancel, handleRetry, handleClear, handleKeyDown,
    };
}
