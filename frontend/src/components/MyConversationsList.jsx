import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { myConversationsService } from "../services/api";
import { avatarGradient } from "../utils/avatarColor";
import { useAuth } from "../context/AuthContext";
import "./MyConversationsList.css";

function formatRelativeTime(dateString) {
    if (!dateString) return "";
    const diffMs = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "ahora";
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `hace ${days} d`;
    return new Date(dateString).toLocaleDateString();
}

export default function MyConversationsList() {
    const { isAuthenticated } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(isAuthenticated);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        let mounted = true;
        setLoading(true);
        myConversationsService
            .list()
            .then((list) => { if (mounted) setConversations(list); })
            .catch(() => { if (mounted) setError("No se pudieron cargar tus conversaciones."); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <div className="my-conversations">
                <p className="my-conversations-empty">
                    <Link to="/login">Iniciá sesión</Link> para ver tu historial de conversaciones.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="my-conversations">
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line skeleton-line--short" />
            </div>
        );
    }

    return (
        <div className="my-conversations">
            {error && <p className="my-conversations-error">{error}</p>}
            {!error && conversations.length === 0 && (
                <p className="my-conversations-empty">
                    Todavía no hablaste con ningún candidato. Buscá perfiles y empezá una charla.
                </p>
            )}
            <div className="my-conversations-list">
                {conversations.map((conv) => (
                    <Link key={conv.candidateId} to={`/${conv.candidateId}`} className="my-conversation-item">
                        <div
                            className="my-conversation-avatar"
                            style={conv.profilePhotoUrl ? undefined : { background: avatarGradient(conv.nombre) }}
                        >
                            {conv.profilePhotoUrl
                                ? <img src={conv.profilePhotoUrl} alt="" />
                                : <span>{(conv.nombre || "?").charAt(0).toUpperCase()}</span>}
                        </div>
                        <div className="my-conversation-info">
                            <span className="my-conversation-name">
                                {conv.nombre} {conv.apellido || ""}
                            </span>
                            {conv.puestoActual && <span className="my-conversation-role">{conv.puestoActual}</span>}
                            {conv.lastMessageSnippet && (
                                <span className="my-conversation-snippet">{conv.lastMessageSnippet}</span>
                            )}
                        </div>
                        <span className="my-conversation-time">{formatRelativeTime(conv.updatedAt)}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
