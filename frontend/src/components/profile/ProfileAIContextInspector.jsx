import React from "react";

const barWidth = (value) => `${Math.max(0, Math.min(100, value))}%`;

export default function ProfileAIContextInspector({
    completion,
    sectionCompletion,
    dataSummary,
    criticalMissing,
    qualityChecklist,
}) {
    return (
        <section id="section-inspector-ia" className="ai-inspector" aria-labelledby="ai-inspector-title">
            <header className="ai-inspector__header">
                <div>
                    <span className="ai-inspector__kicker">Inspector de contexto IA</span>
                    <h2 id="ai-inspector-title">Validacion de contexto y calidad del perfil</h2>
                    <p>
                        Esta vista te muestra que informacion tiene la IA, que falta para mejorar respuestas y que
                        tan robusta es tu base para entrevistas.
                    </p>
                </div>
                <div className="ai-inspector__score">
                    <strong>{completion}%</strong>
                    <span>completitud general</span>
                </div>
            </header>

            <div className="ai-inspector__grid">
                <article className="ai-inspector__card">
                    <h3>Completitud por seccion</h3>
                    <ul className="inspector-list">
                        {sectionCompletion.map((section) => (
                            <li key={section.key}>
                                <div className="inspector-list__row">
                                    <span>{section.label}</span>
                                    <strong>{section.value}%</strong>
                                </div>
                                <div className="inspector-progress" aria-hidden="true">
                                    <span style={{ width: barWidth(section.value) }} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </article>

                <article className="ai-inspector__card">
                    <h3>Resumen de datos cargados</h3>
                    <ul className="inspector-summary">
                        {dataSummary.map((item) => (
                            <li key={item.key}>
                                <span>{item.label}</span>
                                <strong>{item.value}</strong>
                            </li>
                        ))}
                    </ul>

                    <h4>Campos criticos pendientes</h4>
                    {criticalMissing.length === 0 ? (
                        <p className="inspector-ok">Sin faltantes criticos. El contexto base esta bien cubierto.</p>
                    ) : (
                        <ul className="inspector-missing">
                            {criticalMissing.map((field) => (
                                <li key={field}>{field}</li>
                            ))}
                        </ul>
                    )}
                </article>

                <article className="ai-inspector__card">
                    <h3>Checklist para respuestas del chat</h3>
                    <ul className="inspector-checklist">
                        {qualityChecklist.map((item) => (
                            <li key={item.key} className={item.done ? "is-done" : "is-pending"}>
                                <span className="check-indicator" aria-hidden="true">
                                    {item.done ? "OK" : "!"}
                                </span>
                                <div>
                                    <strong>{item.title}</strong>
                                    <p>{item.help}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </article>
            </div>
        </section>
    );
}
