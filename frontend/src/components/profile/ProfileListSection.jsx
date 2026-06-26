import React, { useEffect, useState } from "react";
import ProfileSection from "./ProfileSection";

const getItemQuality = (item) => {
  const checks = [
    Boolean(item.titulo?.trim()),
    Boolean(item.descripcion?.trim()),
    Boolean(item.organizacion?.trim() || item.nivel?.trim() || item.categoria?.trim()),
  ];

  const completed = checks.filter(Boolean).length;

  if (completed === checks.length) {
    return { label: "Listo para IA", tone: "ok" };
  }

  if (completed === 0) {
    return { label: "Sin datos", tone: "empty" };
  }

  return { label: "Faltan datos", tone: "warn" };
};

export default function ProfileListSection({
  section,
  items,
  isOpen,
  onToggle,
  onFocusSection,
  onAdd,
  onChange,
  onRemove,
}) {
  const [expandedItemId, setExpandedItemId] = useState(null);

  useEffect(() => {
    if (!items.some((item) => item.id === expandedItemId)) {
      setExpandedItemId(null);
    }
  }, [items, expandedItemId]);

  const toggleItem = (itemId) => {
    setExpandedItemId((current) => (current === itemId ? null : itemId));
    onFocusSection?.(section.field);
  };

  const openFirstItem = () => {
    if (!items.length) return;
    setExpandedItemId(items[0].id);
    onFocusSection?.(section.field);
  };

  return (
    <ProfileSection
      sectionKey={section.field}
      title={section.title}
      hint={section.helper}
      isOpen={isOpen}
      onToggle={onToggle}
      badge={items.length}
    >
      {items.length === 0 && (
        <div className="empty-state">
          <strong>{section.title}</strong>
          <p>
            Esta seccion todavia no tiene contenido. Agrega al menos un {section.singular} con contexto
            concreto para mejorar la precision de la IA.
          </p>
        </div>
      )}

      {items.length > 1 && (
        <p className="section-note">
          Edita un solo {section.singular} por vez para mantener foco y completar con mejor calidad.
        </p>
      )}

      {items.map((item, index) => (
        <article key={item.id} className={`sub-item ${expandedItemId === item.id ? "is-expanded" : ""}`}>
          <div className="sub-item-topbar">
            <button type="button" className="sub-item-summary" onClick={() => toggleItem(item.id)}>
              <div className="sub-item-topbar-left">
                <span className="sub-item-index">{section.singular} {index + 1}</span>
                <span className={`item-quality item-quality--${getItemQuality(item).tone}`}>
                  {getItemQuality(item).label}
                </span>
              </div>

              <strong className="sub-item-main-title">
                {item.titulo?.trim() || `Sin ${section.titleLabel?.toLowerCase() || "titulo"}`}
              </strong>

              <div className="sub-item-preview-meta">
                {item.organizacion && <span>{item.organizacion}</span>}
                {item.nivel && <span>{item.nivel}</span>}
                {item.fechaInicio && <span>{item.fechaInicio}</span>}
                {item.enCurso && <span>Actual</span>}
              </div>
            </button>

            <div className="sub-item-actions">
              <button
                type="button"
                className="item-action-btn"
                onClick={() => toggleItem(item.id)}
              >
                {expandedItemId === item.id ? "Cerrar" : "Editar"}
              </button>
              <button
                type="button"
                className="item-action-btn item-action-btn--danger"
                onClick={() => onRemove(section.field, item.id)}
                title="Eliminar"
              >
                Eliminar
              </button>
            </div>
          </div>

          {expandedItemId === item.id && (
            <div className="sub-item-editor">
              <div className="field-group sub-item-title-field">
                <label>{section.titleLabel || "Título principal"}</label>
                <input
                  placeholder={section.placeholder}
                  value={item.titulo}
                  onChange={(e) => onChange(section.field, item.id, "titulo", e.target.value)}
                />
              </div>

              {section.metaFields?.length > 0 && (
                <div className="sub-item-block">
                  <div className="sub-item-block-title">Informacion clave</div>
                  <div className="sub-item-meta-grid">
                    {section.metaFields.map((field) => {
                      if (field.type === "checkbox") {
                        return (
                          <label
                            key={`${item.id}-${field.name}`}
                            className={`meta-checkbox ${field.fullWidth ? "full-width" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(item[field.name])}
                              onChange={(e) => onChange(section.field, item.id, field.name, e.target.checked)}
                            />
                            <span>{field.label}</span>
                          </label>
                        );
                      }

                      if (field.type === "select") {
                        return (
                          <div
                            key={`${item.id}-${field.name}`}
                            className={`field-group meta-field ${field.fullWidth ? "full-width" : ""}`}
                          >
                            <label>{field.label}</label>
                            <select
                              value={item[field.name] || ""}
                              onChange={(e) => onChange(section.field, item.id, field.name, e.target.value)}
                            >
                              <option value="">Seleccionar</option>
                              {field.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${item.id}-${field.name}`}
                          className={`field-group meta-field ${field.fullWidth ? "full-width" : ""}`}
                        >
                          <label>{field.label}</label>
                          <input
                            type={field.type || "text"}
                            placeholder={field.placeholder}
                            value={item[field.name] || ""}
                            disabled={field.name === "fechaFin" && Boolean(item.enCurso)}
                            onChange={(e) => onChange(section.field, item.id, field.name, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="field-group">
                <label>Descripcion y logros</label>
                <textarea
                  placeholder={section.descriptionPlaceholder || "Anade contexto, resultados, herramientas o aprendizajes clave."}
                  value={item.descripcion}
                  onChange={(e) => onChange(section.field, item.id, "descripcion", e.target.value)}
                />
              </div>
            </div>
          )}
        </article>
      ))}

      <button type="button" className="add-btn" onClick={() => onAdd(section.field)}>
        + Agregar {section.singular}
      </button>

      {items.length > 0 && expandedItemId === null && (
        <button type="button" className="add-btn add-btn--ghost" onClick={openFirstItem}>
          Editar {section.singular} mas reciente
        </button>
      )}
    </ProfileSection>
  );
}
