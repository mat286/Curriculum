import React from "react";

export default function ProfileSection({
  sectionKey,
  title,
  hint,
  isOpen,
  onToggle,
  badge,
  children,
  actions,
}) {
  return (
    <section id={`section-${sectionKey}`} className="section">
      <button type="button" className="section-title" onClick={onToggle}>
        <span>
          <span className="section-label">{title}</span>
          {hint && <span className="section-hint">{hint}</span>}
        </span>

        <span className="section-actions">
          {actions}
          {typeof badge !== "undefined" && badge !== null && (
            <span className="section-badge">{badge}</span>
          )}
          <span className="section-chevron">{isOpen ? "−" : "+"}</span>
        </span>
      </button>

      {isOpen && <div className="section-content">{children}</div>}
    </section>
  );
}
