import React, { useEffect } from "react";
import "./CVModal.css";

const formatDateRange = (item) => {
  const start = item?.fechaInicio;
  const end = item?.enCurso ? "Actualidad" : item?.fechaFin;

  if (!start && !end) return "";
  if (start && end) return `${start} → ${end}`;
  return start || end || "";
};

const renderItems = (items = [], emptyMessage) => {
  if (!items.length) {
    return <p className="cv-empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="cv-stack-list">
      {items.map((item) => {
        const meta = [item.organizacion, item.rol, item.ubicacion, item.nivel || item.categoria, formatDateRange(item)]
          .filter(Boolean)
          .join(" · ");

        return (
          <article key={item.id} className="cv-stack-item">
            <h4>{item.titulo}</h4>
            {meta && <div className="cv-item-meta">{meta}</div>}
            {item.descripcion && <p>{item.descripcion}</p>}
            {item.enlace && (
              <a className="cv-item-link" href={item.enlace} target="_blank" rel="noreferrer">
                Ver enlace
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
};

export default function CVModal({ isOpen, onClose, profile }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !profile) return null;

  const contactLinks = [
    profile.linkedinUrl && { label: "LinkedIn", href: profile.linkedinUrl },
    profile.githubUrl && { label: "GitHub", href: profile.githubUrl },
    profile.portfolioUrl && { label: "Portfolio", href: profile.portfolioUrl },
  ].filter(Boolean);

  return (
    <div className="cv-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cv-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cv-modal-header">
          <div>
            <span className="cv-modal-kicker">Vista CV</span>
            <h2 id="cv-modal-title">{profile.name || "Perfil profesional"}</h2>
            <p>{profile.headline || "CV conversacional listo para compartir."}</p>
          </div>

          <button type="button" className="cv-close-button" onClick={onClose} aria-label="Cerrar CV">
            ×
          </button>
        </div>

        <div className="cv-modal-body">
          <section className="cv-hero-card">
            <div>
              <span className="cv-chip">Perfil</span>
              <p>{profile.summary || "Completa tu perfil para mostrar una mejor síntesis profesional."}</p>
            </div>

            <div className="cv-meta-grid">
              {profile.location && <span>{profile.location}</span>}
              {profile.availability && <span>{profile.availability}</span>}
              {profile.preferredMode && <span>{profile.preferredMode}</span>}
              {profile.salary && <span>{profile.salary}</span>}
            </div>

            {contactLinks.length > 0 && (
              <div className="cv-link-row">
                {contactLinks.map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </section>

          <div className="cv-grid">
            <section className="cv-section-card">
              <h3>Skills</h3>
              <div className="cv-tag-list">
                {profile.skills?.length ? (
                  profile.skills.map((skill) => <span key={skill.id}>{skill.titulo}</span>)
                ) : (
                  <p className="cv-empty-state">Sin habilidades cargadas todavía.</p>
                )}
              </div>
            </section>

            <section className="cv-section-card">
              <h3>Experiencia</h3>
              {renderItems(profile.experiences, "Aún no hay experiencias cargadas.")}
            </section>

            <section className="cv-section-card">
              <h3>Proyectos</h3>
              {renderItems(profile.projects, "Todavía no hay proyectos visibles.")}
            </section>

            <section className="cv-section-card">
              <h3>Formación e idiomas</h3>
              {renderItems(profile.studies, "No se registró formación académica todavía.")}
              {profile.languages?.length > 0 && (
                <div className="cv-tag-list compact">
                  {profile.languages.map((language) => (
                    <span key={language.id}>{language.titulo}</span>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
