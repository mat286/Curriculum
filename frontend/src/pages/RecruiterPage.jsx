import React, { useState } from "react";
import { Link } from "react-router-dom";
import { recruiterService } from "../services/api";
import "./RecruiterPage.css";

export default function RecruiterPage() {
    const [messages, setMessages] = useState([
        {
            id: "welcome",
            role: "assistant",
            content: "Hola, soy tu asistente de recruiting. ¿Qué tipo de perfil estás buscando?",
        },
    ]);
    const [input, setInput] = useState("");
    const [phase, setPhase] = useState("collect");
    const [jobProfile, setJobProfile] = useState({});
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSend = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const nextMessages = [...messages, { id: `u-${Date.now()}`, role: "user", content: text }];
        setMessages(nextMessages);
        setInput("");
        setLoading(true);
        setError("");

        try {
            const response = await recruiterService.chat({
                message: text,
                conversationHistory: nextMessages.map((m) => ({ role: m.role, content: m.content })),
                phase,
                jobProfile,
            });

            setJobProfile(response.jobProfile || {});
            setMessages((current) => [...current, { id: `a-${Date.now()}`, role: "assistant", content: response.message }]);

            if (response.phase === "results") {
                setPhase("results");
                setResults(response.candidates || []);
            }
        } catch (err) {
            const is403 = err.message?.toLowerCase().includes('autorizado') || err.response?.status === 403;
            if (is403) {
                setError('Tu cuenta no tiene permisos de recruiter. Ve a Configuración para activar el modo recruiter.');
            } else {
                setError(err.message || "No se pudo completar la búsqueda.");
            }
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

    const handleReset = () => {
        setMessages([
            {
                id: "welcome",
                role: "assistant",
                content: "Hola, soy tu asistente de recruiting. ¿Qué tipo de perfil estás buscando?",
            },
        ]);
        setInput("");
        setPhase("collect");
        setJobProfile({});
        setResults([]);
        setError("");
    };

    return (
        <div className="recruiter-page">
            <section className="recruiter-chat-panel">
                <div className="recruiter-header">
                    <div>
                        <span className="app-eyebrow">Modo recruiter</span>
                        <h1>Búsqueda conversacional de candidatos</h1>
                        <p>Describe el perfil ideal y la IA te ayuda a afinar la búsqueda hasta encontrar los mejores matches.</p>
                    </div>
                    {phase === "results" && (
                        <button type="button" className="reset-search-btn" onClick={handleReset}>
                            Nueva búsqueda
                        </button>
                    )}
                </div>

                <div className="recruiter-panel-badges">
                    <span>IA de recruiting activa</span>
                    <span>{phase === "results" ? `${results.length} candidatos sugeridos` : "Brief en construcción"}</span>
                </div>

                <div className="recruiter-messages">
                    {messages.map((message) => (
                        <div key={message.id} className={`recruiter-bubble ${message.role}`}>
                            {message.content}
                        </div>
                    ))}
                    {loading && <div className="recruiter-bubble assistant">Procesando…</div>}
                </div>

                {error && <div className="recruiter-error">{error}</div>}

                <div className="recruiter-input-row">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={3}
                        placeholder="Ej: Busco un backend developer semi-senior con Node.js, APIs REST y Docker"
                    />
                    <button type="button" onClick={handleSend} disabled={loading || !input.trim()}>
                        {loading ? "Enviando..." : phase === "results" ? "Refinar" : "Enviar"}
                    </button>
                </div>
            </section>

            <aside className="recruiter-results-panel">
                <div className="recruiter-results-top">
                    <span className="app-eyebrow">Panel de resultados</span>
                    <p>Revisa el perfil interpretado por la IA y abre el chat de cada candidato para profundizar.</p>
                </div>

                <pre className="job-profile-preview">{JSON.stringify(jobProfile, null, 2)}</pre>

                <div className="results-header-row">
                    <h2>Resultados</h2>
                    <span>{results.length} candidatos</span>
                </div>

                {results.length === 0 ? (
                    <div className="results-empty">Todavía no hay resultados. Define el perfil y la IA hará la búsqueda.</div>
                ) : (
                    <div className="results-list">
                        {results.map((candidate) => (
                            <article key={candidate.id} className="result-card">
                                <div className="result-card-top">
                                    <div>
                                        <h3>{candidate.nombre}</h3>
                                        {candidate.puestoActual && <p>{candidate.puestoActual}</p>}
                                    </div>
                                    <span className="score-badge">{candidate.score}%</span>
                                </div>

                                {candidate.resumen && <p className="result-summary">{candidate.resumen}</p>}
                                {candidate.reason && <p className="result-reason">{candidate.reason}</p>}

                                {candidate.habilidades?.length > 0 && (
                                    <div className="result-tags">
                                        {candidate.habilidades.slice(0, 5).map((skill) => (
                                            <span key={skill}>{skill}</span>
                                        ))}
                                    </div>
                                )}

                                <Link to={`/${candidate.id}`} className="result-link">
                                    Ver perfil / hablar con esta persona →
                                </Link>
                            </article>
                        ))}
                    </div>
                )}
            </aside>
        </div>
    );
}
