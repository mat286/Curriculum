import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { candidatesService } from "../services/api";
import "./Home.css";

const PRODUCT_STEPS = [
    {
        title: "1. Carga tu historia profesional",
        description: "Organiza experiencia, skills, proyectos y respuestas clave para que la IA entienda tu perfil con contexto real.",
    },
    {
        title: "2. Activa tu CV conversacional",
        description: "El sistema transforma tu información en una experiencia interactiva que puede responder como tú, en primera persona.",
    },
    {
        title: "3. Deja que lo exploren recruiters",
        description: "En lugar de leer un PDF estático, pueden conversar, descubrir tu valor y entender tu perfil en minutos.",
    },
];

const BENEFITS = [
    {
        title: "Más memorable",
        description: "Tu perfil deja de verse como un documento plano y se convierte en una demo profesional con personalidad.",
    },
    {
        title: "Más claro para recruiters",
        description: "Las respuestas guiadas por IA ayudan a entender experiencia, motivaciones y fortalezas más rápido.",
    },
    {
        title: "Más listo para entrevista",
        description: "Practica preguntas frecuentes, resume tu experiencia y mejora tu narrativa antes de cada oportunidad.",
    },
];

export default function Home() {
    const { isAuthenticated, user } = useAuth();
    const [search, setSearch] = useState("");
    const [candidates, setCandidates] = useState([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;
        setLoadingCandidates(true);
        candidatesService.getAll()
            .then(data => setCandidates(data || []))
            .catch(() => setCandidates([]))
            .finally(() => setLoadingCandidates(false));
    }, [isAuthenticated]);

    const filteredCandidates = candidates.filter(c => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return `${c.nombre} ${c.puestoActual || ''} ${c.resumen || ''} ${(c.habilidades || []).join(' ')}`.toLowerCase().includes(term);
    });

    return (
        <div className="home-page">
            <section className="home-hero page-shell">
                <div className="hero-copy">
                    <span className="app-eyebrow">CV conversacional con IA</span>
                    <h1>Tu experiencia profesional ahora se puede conversar.</h1>
                    <p>
                        Convierte tu perfil en una experiencia interactiva para recruiters: una demo moderna donde la IA
                        responde como si fuera la persona, con claridad, contexto y una mejor narrativa profesional.
                    </p>

                    <div className="hero-actions">
                        {isAuthenticated ? (
                            <>
                                <Link to={`/${user?.id}`} className="primary-btn">
                                    Probar mi demo
                                </Link>
                                <Link to="/search" className="secondary-btn">
                                    Buscar candidatos
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="primary-btn">
                                    Iniciar sesión
                                </Link>
                                <a href="#como-funciona" className="ghost-btn">
                                    Ver cómo funciona
                                </a>
                            </>
                        )}
                    </div>

                    <ul className="hero-metrics">
                        <li>
                            <strong>24/7</strong>
                            <span>demo siempre disponible</span>
                        </li>
                        <li>
                            <strong>IA</strong>
                            <span>respuestas en primera persona</span>
                        </li>
                        <li>
                            <strong>UX</strong>
                            <span>pensada para recruiters</span>
                        </li>
                    </ul>
                </div>

                <div className="hero-visual">
                    <div className="hero-window">
                        <div className="hero-window-bar">
                            <span />
                            <span />
                            <span />
                        </div>

                        <div className="hero-conversation">
                            <div className="message-preview recruiter">
                                “Necesito entender rápido si este perfil encaja para un rol híbrido y con foco en impacto.”
                            </div>
                            <div className="message-preview ai">
                                “Soy Mateo. Trabajo entre producto, tecnología y comunicación. Mi fuerte es convertir ideas
                                complejas en soluciones claras y ejecutables.”
                            </div>
                        </div>

                        <div className="hero-pill-row">
                            <span>Perfil claro</span>
                            <span>Skills visibles</span>
                            <span>Storytelling profesional</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="page-shell home-section">
                <div className="section-heading">
                    <span className="app-eyebrow">Qué hace distinto a este producto</span>
                    <h2>No es solo un CV: es una experiencia de descubrimiento.</h2>
                </div>

                <div className="benefit-grid">
                    {BENEFITS.map((item) => (
                        <article key={item.title} className="info-card">
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section id="como-funciona" className="page-shell home-section">
                <div className="section-heading">
                    <span className="app-eyebrow">Cómo funciona</span>
                    <h2>Una interfaz simple para mostrar talento de una forma más humana.</h2>
                </div>

                <div className="workflow-grid">
                    {PRODUCT_STEPS.map((step) => (
                        <article key={step.title} className="step-card">
                            <h3>{step.title}</h3>
                            <p>{step.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section id="explorar" className="page-shell home-section search-section">
                <div className="section-heading with-row">
                    <div>
                        <span className="app-eyebrow">Perfiles disponibles</span>
                        <h2>Explorá candidatos o usá la búsqueda inteligente con IA.</h2>
                    </div>
                    {isAuthenticated && (
                        <Link to="/search" className="primary-btn">
                            Buscar con IA →
                        </Link>
                    )}
                </div>

                <div className="search-toolbar">
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={
                            isAuthenticated
                                ? "Buscar por nombre, rol, habilidades..."
                                : "Inicia sesión para explorar candidatos"
                        }
                        disabled={!isAuthenticated}
                    />
                    {isAuthenticated && (
                        <span>
                            {loadingCandidates
                                ? "Cargando..."
                                : `${filteredCandidates.length} perfil${filteredCandidates.length !== 1 ? "es" : ""}`}
                        </span>
                    )}
                </div>

                {isAuthenticated ? (
                    loadingCandidates ? (
                        <div className="empty-directory">Cargando perfiles...</div>
                    ) : filteredCandidates.length > 0 ? (
                        <div className="candidates-grid">
                            {filteredCandidates.map(c => (
                                <article key={c.id} className="candidate-card">
                                    <div className="candidate-card-header">
                                        <div className="candidate-avatar-initials">
                                            {c.nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="candidate-name">{c.nombre}</h3>
                                            {c.puestoActual && <p className="candidate-role">{c.puestoActual}</p>}
                                        </div>
                                    </div>
                                    {c.resumen && (
                                        <p className="candidate-summary">
                                            {c.resumen.length > 120 ? c.resumen.slice(0, 120) + '…' : c.resumen}
                                        </p>
                                    )}
                                    {c.habilidades.length > 0 && (
                                        <div className="candidate-skills">
                                            {c.habilidades.slice(0, 4).map(s => (
                                                <span key={s} className="skill-tag">{s}</span>
                                            ))}
                                        </div>
                                    )}
                                    <Link to={`/${c.id}`} className="candidate-cta">
                                        Hablar con {c.nombre.split(' ')[0]} →
                                    </Link>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-directory">
                            {search ? "No encontramos perfiles con esa búsqueda." : "Todavía no hay candidatos con perfil público activo."}
                        </div>
                    )
                ) : (
                    <div className="empty-directory">
                        Inicia sesión para explorar perfiles y usar la búsqueda con IA.
                    </div>
                )}
            </section>

            <section className="page-shell home-cta-banner">
                <div>
                    <span className="app-eyebrow">Listo para mostrar</span>
                    <h2>Pasa de un CV tradicional a un producto que se puede explorar.</h2>
                    <p>
                        Diseñado para transmitir innovación, claridad y profesionalismo desde el primer minuto.
                    </p>
                </div>

                <div className="cta-actions">
                    <Link to={isAuthenticated ? `/${user?.id}` : "/login"} className="primary-btn">
                        {isAuthenticated ? "Abrir mi demo" : "Comenzar ahora"}
                    </Link>
                    {isAuthenticated && (
                        <Link to="/perfil" className="secondary-btn">
                            Completar perfil
                        </Link>
                    )}
                </div>
            </section>
        </div>
    );
}
