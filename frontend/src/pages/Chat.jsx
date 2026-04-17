import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CVModal from "../components/CVModal";
import { useAuth } from "../context/AuthContext";
import { chatService, userService } from "../services/api";
import { ERROR_MESSAGES } from "../utils/constants";
import "./Chat.css";

const CHAT_HISTORY_STORAGE_PREFIX = "cv-chat-history";
const CHAT_DRAFT_STORAGE_PREFIX = "cv-chat-draft";
const CHAT_SUGGESTIONS = [
  "Cuéntame mi experiencia profesional en 30 segundos",
  "¿Cómo responder si me preguntan por mis fortalezas?",
  "Hazme una simulación de entrevista técnica",
  "Resúmeme mi perfil para una vacante administrativa",
];

const toText = (value) => (value === null || typeof value === "undefined" ? "" : String(value));
const toBoolean = (value) => value === true || value === 1 || value === "1" || value === "true";

const normalizeItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => ({
    id: item?.id ?? `item-${index}`,
    titulo: toText(
      item?.titulo || item?.nombre || item?.idioma || item?.puesto || item?.empresa || item?.institucion
    ),
    descripcion: toText(
      item?.descripcion || item?.detalle || item?.nivel || item?.categoria || item?.tecnologias
    ),
    organizacion: toText(item?.organizacion || item?.empresa || item?.institucion || item?.entidad),
    ubicacion: toText(item?.ubicacion || item?.location),
    fechaInicio: toText(item?.fechaInicio || item?.fecha_inicio || item?.desde).slice(0, 7),
    fechaFin: toText(item?.fechaFin || item?.fecha_fin || item?.hasta).slice(0, 7),
    enCurso: toBoolean(item?.enCurso ?? item?.en_curso ?? item?.actual),
    enlace: toText(item?.enlace || item?.url || item?.link || item?.github || item?.demo_url),
    nivel: toText(item?.nivel || item?.level),
    categoria: toText(item?.categoria || item?.category),
    rol: toText(item?.rol),
  }));
};

const normalizeProfileForChat = (data = {}, fallbackUser = {}) => {
  const about = Array.isArray(data.sobre_mi) ? data.sobre_mi[0] || {} : data.sobre_mi || {};
  const fullName =
    [data.usuario?.nombre || fallbackUser?.nombre, data.usuario?.apellido || fallbackUser?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    fallbackUser?.email?.split("@")[0] ||
    "Perfil profesional";

  return {
    name: fullName,
    headline: toText(data.usuario?.resumen || data.usuario?.puesto_actual || fallbackUser?.puesto || "CV conversacional activo"),
    summary: toText(
      about.descripcion ||
        data.usuario?.objetivo_profesional ||
        data.usuario?.resumen ||
        fallbackUser?.resumen ||
        "Completa tu perfil para que la IA entregue respuestas más ricas y útiles."
    ),
    location: toText(data.usuario?.direccion || fallbackUser?.direccion),
    availability: toText(data.usuario?.disponibilidad),
    preferredMode: toText(data.usuario?.modalidad_preferida),
    salary: toText(data.usuario?.pretension_salarial),
    linkedinUrl: toText(data.usuario?.linkedin_url),
    githubUrl: toText(data.usuario?.github_url),
    portfolioUrl: toText(data.usuario?.portfolio_url),
    experiences: normalizeItems(data.experiencia_laboral),
    projects: normalizeItems(data.proyectos),
    skills: normalizeItems(data.habilidades),
    studies: normalizeItems(data.educacion),
    languages: normalizeItems(data.idiomas),
  };
};

const getChatHistoryKey = (userId) => (userId ? `${CHAT_HISTORY_STORAGE_PREFIX}:${userId}` : null);
const getChatDraftKey = (userId) => (userId ? `${CHAT_DRAFT_STORAGE_PREFIX}:${userId}` : null);

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profileData, setProfileData] = useState(() => normalizeProfileForChat({}, user || {}));
  const [showCVModal, setShowCVModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const userId = user?.id || user?.userId || user?.googleId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.add("chat-page-active");

    return () => {
      document.body.classList.remove("chat-page-active");
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;

    const historyKey = getChatHistoryKey(userId);
    const draftKey = getChatDraftKey(userId);

    try {
      const storedMessages = window.localStorage.getItem(historyKey);
      const storedDraft = window.localStorage.getItem(draftKey);

      if (storedMessages) {
        const parsedMessages = JSON.parse(storedMessages);
        if (Array.isArray(parsedMessages)) {
          setMessages(parsedMessages);
        }
      }

      if (storedDraft) {
        setInput(storedDraft);
      }
    } catch (storageError) {
      console.error("No se pudo restaurar el historial local del chat:", storageError);
    }
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;

    try {
      const historyKey = getChatHistoryKey(userId);
      window.localStorage.setItem(historyKey, JSON.stringify(messages));
    } catch (storageError) {
      console.error("No se pudo guardar el historial local del chat:", storageError);
    }
  }, [messages, userId]);

  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;

    try {
      const draftKey = getChatDraftKey(userId);
      if (input.trim()) {
        window.localStorage.setItem(draftKey, input);
      } else {
        window.localStorage.removeItem(draftKey);
      }
    } catch (storageError) {
      console.error("No se pudo guardar el borrador del chat:", storageError);
    }
  }, [input, userId]);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      if (!userId) {
        setProfileData(normalizeProfileForChat({}, user || {}));
        return;
      }

      try {
        const data = await userService.getProfile(userId);
        if (isMounted) {
          setProfileData(normalizeProfileForChat(data, user || {}));
        }
      } catch (err) {
        console.error("Error cargando el perfil para el chat:", err);
        if (isMounted) {
          setProfileData(normalizeProfileForChat({}, user || {}));
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [userId, user]);

  const userQuestionsCount = messages.filter((message) => message.sender === "user").length;
  const shouldShowSuggestions = !input.trim() && messages.length === 0;

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    if (!userId) {
      setError("No se encontró el ID del usuario. Por favor, inicia sesión nuevamente.");
      return;
    }

    const userMessage = input.trim();
    const newMessage = { sender: "user", text: userMessage, timestamp: new Date() };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const data = await chatService.askQuestion(userMessage, userId);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: data.answer || "No se recibió respuesta.", timestamp: new Date() },
      ]);
    } catch (err) {
      console.error("Error en chat:", err);
      const message = err.message || ERROR_MESSAGES.UNKNOWN_ERROR;
      setMessages((prev) => [...prev, { sender: "bot", text: message, timestamp: new Date() }]);
      setError(message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleClearConversation = () => {
    if (messages.length > 0 && typeof window !== "undefined") {
      const shouldClear = window.confirm("¿Quieres borrar esta conversación guardada localmente?");
      if (!shouldClear) return;
    }

    setMessages([]);
    setInput("");
    setError(null);

    if (typeof window !== "undefined" && userId) {
      window.localStorage.removeItem(getChatHistoryKey(userId));
      window.localStorage.removeItem(getChatDraftKey(userId));
    }

    inputRef.current?.focus();
  };

  return (
    <div className="chat-shell theme-dark">
      <div className={`chat-workspace ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {!isSidebarCollapsed && (
          <aside className="chat-sidebar">
            <div className="context-card profile-overview">
              <div className="context-card-top">
                <span className="chat-badge">Perfil en vivo</span>
              </div>

              <h2>{profileData?.name || "Perfil conversacional"}</h2>
              <p className="context-summary">{profileData?.summary}</p>

              <div className="chat-highlight-list">
                {(profileData?.skills || []).slice(0, 3).map((item) => (
                  <span key={item.id}>{item.titulo}</span>
                ))}
              </div>

              <div className="context-actions">
                <Link to="/perfil" className="context-secondary-btn">
                  Editar perfil
                </Link>
              </div>
            </div>

            <div className="context-card">
              <h3>Contexto que usa la IA</h3>
              <div className="chat-status-row">
                <span className="chat-status-pill">{userQuestionsCount} preguntas enviadas</span>
                <span className="chat-status-pill">Historial local activo</span>
              </div>
            </div>
          </aside>
        )}

        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-copy">
              <span className="chat-owner-label">Chat de {profileData?.name || "tu perfil"}</span>
              <h1>Simulador de entrevista</h1>
              <p>
                Practica respuestas, resume tu experiencia y comparte una versión mucho más humana y entendible de tu perfil.
              </p>
            </div>

            <div className="chat-toolbar">
              <div className="chat-toolbar-actions">
                <button
                  type="button"
                  className={`panel-toggle-button ${isSidebarCollapsed ? "primary" : ""}`}
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  aria-expanded={!isSidebarCollapsed}
                >
                  {isSidebarCollapsed ? "☰ Mostrar panel" : "← Ocultar panel"}
                </button>
                <button type="button" className="theme-toggle secondary" onClick={() => setShowCVModal(true)}>
                  📄 Ver CV
                </button>
                <button type="button" className="theme-toggle secondary" onClick={handleClearConversation}>
                  ↺ Nueva conversación
                </button>
              </div>
            </div>
          </div>

          {error && <div className="chat-error">{error}</div>}

          {messages.length > 0 && (
            <div className="chat-info-banner">
              Tu conversación se guarda localmente para que puedas retomarla después.
            </div>
          )}

          <div className="chat-box">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-card">
                  <h2>Empieza la conversación</h2>
                  <p>
                    Haz una pregunta directa sobre tu experiencia, fortalezas o sobre cómo te presentarías en una entrevista.
                  </p>
                </div>

                {shouldShowSuggestions && (
                  <div className="suggestion-list">
                    {CHAT_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div key={`${m.sender}-${i}`} className={`message ${m.sender}`}>
                    <div className="message-role">{m.sender === "user" ? "Tú" : "Asistente IA"}</div>
                    <div className="message-content">{m.text}</div>
                    {m.timestamp && (
                      <div className="message-timestamp">
                        {new Date(m.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {loading && (
              <div className="message bot">
                <div className="message-role">Asistente IA</div>
                <div className="message-content loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input" onSubmit={handleSend}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              placeholder="Escribe tu pregunta o elige una sugerencia..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? "Pensando..." : "Enviar"}
            </button>
          </form>
        </div>
      </div>

      <CVModal isOpen={showCVModal} onClose={() => setShowCVModal(false)} profile={profileData} />
    </div>
  );
}

