import React, { useCallback, useEffect, useRef, useState } from "react";
import { faqService } from "../../services/api";
import "./ProfileFaqSection.css";

const EMPTY_FORM = { question: "", answer: "", priority: 50 };

export default function ProfileFaqSection({ candidateId }) {
    const [faqs, setFaqs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const formRef = useRef(null);

    const loadFaqs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await faqService.list(candidateId, true);
            setFaqs(data);
        } catch (err) {
            setError(err.message || "Error al cargar las FAQs");
        } finally {
            setLoading(false);
        }
    }, [candidateId]);

    useEffect(() => {
        if (candidateId) loadFaqs();
    }, [candidateId, loadFaqs]);

    const handleEdit = (faq) => {
        setEditingId(faq.id);
        setForm({ question: faq.question, answer: faq.answer, priority: faq.priority });
        setError(null);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    };

    const handleCancel = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: name === "priority" ? Number(value) : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.question.trim() || !form.answer.trim()) {
            setError("La pregunta y la respuesta son obligatorias.");
            return;
        }
        try {
            setSaving(true);
            setError(null);
            if (editingId) {
                await faqService.update(candidateId, editingId, form);
            } else {
                await faqService.create(candidateId, form);
            }
            setForm(EMPTY_FORM);
            setEditingId(null);
            await loadFaqs();
        } catch (err) {
            setError(err.message || "Error al guardar la FAQ");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (faq) => {
        try {
            await faqService.update(candidateId, faq.id, { isActive: !faq.isActive });
            await loadFaqs();
        } catch (err) {
            setError(err.message || "Error al actualizar la FAQ");
        }
    };

    const handleDelete = async (faqId) => {
        if (!window.confirm("¿Eliminar esta FAQ?")) return;
        try {
            await faqService.remove(candidateId, faqId);
            if (editingId === faqId) handleCancel();
            await loadFaqs();
        } catch (err) {
            setError(err.message || "Error al eliminar la FAQ");
        }
    };

    return (
        <section className="faq-section">
            <div className="faq-section__header">
                <h3 className="faq-section__title">Respuestas rápidas del avatar</h3>
                <p className="faq-section__desc">
                    Estas respuestas se usan cuando alguien le hace preguntas frecuentes a tu avatar.
                    Se responden sin consultar al modelo IA, lo que reduce la latencia.
                </p>
            </div>

            {error && <p className="faq-section__error">{error}</p>}

            {/* Formulario */}
            <form ref={formRef} className="faq-form" onSubmit={handleSubmit}>
                <div className="faq-form__row">
                    <label className="faq-form__label">Pregunta</label>
                    <input
                        className="faq-form__input"
                        type="text"
                        name="question"
                        value={form.question}
                        onChange={handleChange}
                        placeholder="Ej: ¿Con qué tecnologías trabajás?"
                        maxLength={300}
                    />
                </div>
                <div className="faq-form__row">
                    <label className="faq-form__label">Respuesta</label>
                    <textarea
                        className="faq-form__textarea"
                        name="answer"
                        value={form.answer}
                        onChange={handleChange}
                        placeholder="Respuesta que dará el avatar en primera persona..."
                        rows={4}
                        maxLength={1500}
                    />
                </div>
                <div className="faq-form__row faq-form__row--inline">
                    <label className="faq-form__label">Prioridad</label>
                    <input
                        className="faq-form__input faq-form__input--small"
                        type="number"
                        name="priority"
                        value={form.priority}
                        onChange={handleChange}
                        min={0}
                        max={100}
                    />
                    <span className="faq-form__hint">Mayor número = más prioridad (0–100)</span>
                </div>
                <div className="faq-form__actions">
                    <button type="submit" className="faq-form__btn faq-form__btn--save" disabled={saving}>
                        {saving ? "Guardando..." : editingId ? "Actualizar FAQ" : "Agregar FAQ"}
                    </button>
                    {editingId && (
                        <button type="button" className="faq-form__btn faq-form__btn--cancel" onClick={handleCancel}>
                            Cancelar
                        </button>
                    )}
                </div>
            </form>

            {/* Lista */}
            {loading ? (
                <p className="faq-section__loading">Cargando FAQs...</p>
            ) : faqs.length === 0 ? (
                <p className="faq-section__empty">
                    Todavía no tenés FAQs. Agregá una arriba para que tu avatar responda más rápido.
                </p>
            ) : (
                <ul className="faq-list">
                    {faqs.map((faq) => (
                        <li key={faq.id} className={`faq-item${faq.isActive ? "" : " faq-item--inactive"}`}>
                            <div className="faq-item__content">
                                <p className="faq-item__question">{faq.question}</p>
                                <p className="faq-item__answer">{faq.answer}</p>
                                <span className="faq-item__meta">Prioridad: {faq.priority}</span>
                            </div>
                            <div className="faq-item__actions">
                                <button
                                    className={`faq-item__btn faq-item__btn--toggle${faq.isActive ? " active" : ""}`}
                                    onClick={() => handleToggleActive(faq)}
                                    title={faq.isActive ? "Desactivar" : "Activar"}
                                >
                                    {faq.isActive ? "Activa" : "Inactiva"}
                                </button>
                                <button
                                    className="faq-item__btn faq-item__btn--edit"
                                    onClick={() => handleEdit(faq)}
                                >
                                    Editar
                                </button>
                                <button
                                    className="faq-item__btn faq-item__btn--delete"
                                    onClick={() => handleDelete(faq.id)}
                                >
                                    Eliminar
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
