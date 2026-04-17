import React from "react";
import "./AvatarCard.css";

const getInitials = (name = "") =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "CV";

export default function AvatarCard({
    avatar,
    primaryLabel = "Hablar con esta persona",
    secondaryLabel = "Ver perfil",
    onPrimaryAction,
    onSecondaryAction,
    disabled = false,
}) {
    const name = avatar?.nombre || avatar?.name || "Perfil conversacional";
    const role = avatar?.puesto || avatar?.role || "Candidato disponible";
    const summary =
        avatar?.resumen ||
        avatar?.summary ||
        "Completa tu perfil para mostrar mejor tu experiencia, skills y proyectos.";
    const tags = avatar?.tags || [];

    return (
        <article className={`avatar-card ${disabled ? "is-disabled" : ""}`}>
            <div className="avatar-card-top">
                {avatar?.imagen ? (
                    <img src={avatar.imagen} alt={name} className="avatar-card-image" />
                ) : (
                    <div className="avatar-card-avatar" aria-hidden="true">
                        {getInitials(name)}
                    </div>
                )}

                <div className="avatar-card-copy">
                    <span className="avatar-card-status">{avatar?.status || "Perfil listo para conversar"}</span>
                    <h3>{name}</h3>
                    <p>{role}</p>
                </div>
            </div>

            <p className="avatar-card-summary">{summary}</p>

            {tags.length > 0 && (
                <div className="avatar-card-tags">
                    {tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                    ))}
                </div>
            )}

            <div className="avatar-card-actions">
                {secondaryLabel && (
                    <button
                        type="button"
                        className="avatar-card-secondary"
                        onClick={onSecondaryAction}
                        disabled={disabled || !onSecondaryAction}
                    >
                        {secondaryLabel}
                    </button>
                )}

                <button
                    type="button"
                    className="avatar-card-primary"
                    onClick={onPrimaryAction}
                    disabled={disabled || !onPrimaryAction}
                >
                    {primaryLabel}
                </button>
            </div>
        </article>
    );
}
