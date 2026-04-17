import React from "react";
import ProfileSection from "./ProfileSection";

export default function ProfileListSection({
  section,
  items,
  isOpen,
  onToggle,
  onAdd,
  onChange,
  onRemove,
}) {
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
        <div className="empty-state">Aún no agregaste información en esta sección.</div>
      )}

      {items.map((item, index) => (
        <div key={item.id} className="sub-item">
          <div className="sub-item-topbar">
            <span className="sub-item-index">{section.singular} {index + 1}</span>
            <button
              type="button"
              className="remove-btn"
              onClick={() => onRemove(section.field, item.id)}
              title="Eliminar"
            >
              ×
            </button>
          </div>

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
              <div className="sub-item-block-title">Información clave</div>
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
            <label>Descripción y logros</label>
            <textarea
              placeholder={section.descriptionPlaceholder || "Añade contexto, resultados, herramientas o aprendizajes clave."}
              value={item.descripcion}
              onChange={(e) => onChange(section.field, item.id, "descripcion", e.target.value)}
            />
          </div>
        </div>
      ))}

      <button type="button" className="add-btn" onClick={() => onAdd(section.field)}>
        + Agregar {section.singular}
      </button>
    </ProfileSection>
  );
}
