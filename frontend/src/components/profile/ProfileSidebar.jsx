import React from "react";
import { Link } from "react-router-dom";

export default function ProfileSidebar({ profile, completion, sections, onJumpToSection }) {
  const fullName = [profile?.nombre, profile?.apellido].filter(Boolean).join(" ").trim() || "Tu perfil";
  const role = profile?.resumen || profile?.puestoActual || "Perfil profesional en construcción";
  const topSkills = (profile?.habilidades || []).slice(0, 4);

  return (
    <aside className="profile-sidebar">
      <div className="profile-preview-card">
        <span className="profile-sidebar-kicker">Vista recruiter-ready</span>
        <h3>{fullName}</h3>
        <p>{role}</p>

        <div className="profile-sidebar-meta">
          {profile?.disponibilidad && <span>{profile.disponibilidad}</span>}
          {profile?.modalidadPreferida && <span>{profile.modalidadPreferida}</span>}
          {profile?.nacionalidad && <span>{profile.nacionalidad}</span>}
        </div>

        {topSkills.length > 0 && (
          <div className="profile-sidebar-skills">
            {topSkills.map((skill) => (
              <span key={skill.id}>{skill.titulo}</span>
            ))}
          </div>
        )}

        <div className="profile-sidebar-progress">
          <strong>{completion}% completo</strong>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${completion}%` }} />
          </div>
        </div>

        <div className="profile-sidebar-actions">
          <Link to="/chat" className="sidebar-primary-btn">
            Ver demo en chat
          </Link>
        </div>
      </div>

      <div className="profile-nav-card">
        <h4>Ir a sección</h4>
        <div className="profile-nav-list">
          {sections.map((section) => (
            <button key={section.key} type="button" onClick={() => onJumpToSection(section.key)}>
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-tip-card">
        <h4>Tip de producto</h4>
        <p>
          Cuanto más concreto sea tu perfil, más naturales y convincentes serán las respuestas de tu IA frente a un recruiter.
        </p>
      </div>
    </aside>
  );
}
