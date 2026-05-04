import React, { useEffect, useMemo, useState } from "react";
import ProfileListSection from "../components/profile/ProfileListSection";
import ProfileSection from "../components/profile/ProfileSection";
import ProfileSidebar from "../components/profile/ProfileSidebar";
import ProfileFaqSection from "../components/profile/ProfileFaqSection";
import { useAuth } from "../context/AuthContext";
import { userService } from "../services/api";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "../utils/constants";
import "./ProfilePage.css";

const FAQ_TEMPLATES = [
    { pregunta: "Contame sobre vos", respuesta: "" },
    { pregunta: "¿Cuáles son tus fortalezas principales?", respuesta: "" },
    { pregunta: "¿Por qué te interesa este puesto?", respuesta: "" },
    { pregunta: "¿Qué valor puedes aportar al equipo?", respuesta: "" },
];

const LIST_SECTIONS = [
    {
        field: "experiencias",
        title: "Experiencia laboral",
        singular: "experiencia",
        titleLabel: "Cargo / puesto",
        placeholder: "Cargo, rol o logro principal",
        helper: "Resume tus responsabilidades y resultados más relevantes.",
        descriptionPlaceholder: "Funciones, herramientas, logros y resultados obtenidos.",
        metaFields: [
            { name: "organizacion", label: "Empresa / organización", placeholder: "Ej: Mercado Libre" },
            { name: "ubicacion", label: "Ubicación / modalidad", placeholder: "Ej: Remoto / Buenos Aires" },
            { name: "fechaInicio", label: "Fecha de inicio", type: "month" },
            { name: "fechaFin", label: "Fecha de fin", type: "month" },
            { name: "enCurso", label: "Actualmente aquí", type: "checkbox", fullWidth: true },
        ],
    },
    {
        field: "estudios",
        title: "Formación académica",
        singular: "estudio",
        titleLabel: "Carrera / título",
        placeholder: "Título, carrera o institución",
        helper: "Incluye estudios formales, tecnicaturas o especializaciones.",
        descriptionPlaceholder: "Nivel, enfoque, aprendizajes o logros destacados.",
        metaFields: [
            { name: "organizacion", label: "Institución", placeholder: "Ej: UBA / UTN" },
            { name: "ubicacion", label: "Ciudad / modalidad", placeholder: "Ej: Híbrido / Córdoba" },
            { name: "fechaInicio", label: "Fecha de inicio", type: "month" },
            { name: "fechaFin", label: "Fecha de fin", type: "month" },
            { name: "enCurso", label: "En curso actualmente", type: "checkbox", fullWidth: true },
        ],
    },
    {
        field: "cursos",
        title: "Cursos y certificaciones",
        singular: "curso",
        titleLabel: "Curso / certificación",
        placeholder: "Curso o certificación",
        helper: "Añade capacitaciones que fortalezcan tu perfil.",
        descriptionPlaceholder: "Entidad, contenido principal o certificación obtenida.",
        metaFields: [
            { name: "organizacion", label: "Entidad / academia", placeholder: "Ej: Coursera / Platzi" },
            { name: "fechaInicio", label: "Fecha de inicio", type: "month" },
            { name: "fechaFin", label: "Fecha de finalización", type: "month" },
            { name: "enCurso", label: "En curso actualmente", type: "checkbox", fullWidth: true },
            { name: "enlace", label: "Certificado o link", type: "url", placeholder: "https://...", fullWidth: true },
        ],
    },
    {
        field: "proyectos",
        title: "Proyectos destacados",
        singular: "proyecto",
        titleLabel: "Nombre del proyecto",
        placeholder: "Nombre del proyecto",
        helper: "Muestra casos reales donde aplicaste tus habilidades.",
        descriptionPlaceholder: "Objetivo, rol, herramientas usadas e impacto.",
        metaFields: [
            { name: "rol", label: "Rol o participación", placeholder: "Ej: Frontend Engineer" },
            { name: "fechaInicio", label: "Fecha de inicio", type: "month" },
            { name: "fechaFin", label: "Fecha de fin", type: "month" },
            { name: "enCurso", label: "Proyecto en curso", type: "checkbox", fullWidth: true },
            { name: "enlace", label: "Demo / repo / link", type: "url", placeholder: "https://...", fullWidth: true },
        ],
    },
    {
        field: "habilidades",
        title: "Habilidades clave",
        singular: "habilidad",
        titleLabel: "Skill / herramienta",
        placeholder: "Habilidad, herramienta o stack",
        helper: "Tecnologías, soft skills o competencias que te diferencian.",
        descriptionPlaceholder: "Contexto de uso o fortaleza concreta.",
        metaFields: [
            { name: "categoria", label: "Categoría", placeholder: "Ej: Frontend / Soft skill" },
            {
                name: "nivel",
                label: "Nivel",
                type: "select",
                options: ["Básico", "Intermedio", "Avanzado", "Experto"],
            },
        ],
    },
    {
        field: "idiomas",
        title: "Idiomas",
        singular: "idioma",
        titleLabel: "Idioma",
        placeholder: "Idioma",
        helper: "Idiomas y nivel conversacional o técnico.",
        descriptionPlaceholder: "Contexto de uso, certificación o experiencia.",
        metaFields: [
            {
                name: "nivel",
                label: "Nivel",
                type: "select",
                options: ["Básico", "Intermedio", "B2", "Avanzado", "Nativo / bilingüe"],
            },
        ],
    },
];

const EMPTY_PROFILE = {
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    fechaNacimiento: "",
    nacionalidad: "",
    direccion: "",
    resumen: "",
    puestoActual: "",
    objetivoProfesional: "",
    disponibilidad: "",
    modalidadPreferida: "",
    pretensionSalarial: "",
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    isPublic: false,
    sobreMi: "",
    experiencias: [],
    estudios: [],
    cursos: [],
    proyectos: [],
    habilidades: [],
    idiomas: [],
    familia: {
        estadoCivil: "",
        hijos: "",
        hermanos: "",
        padresViven: "",
        observaciones: "",
    },
    respuestas: [],
};

const FAMILY_FIELDS = [
    { key: "estadoCivil", label: "Estado civil", type: "input", placeholder: "Ej: Soltero/a" },
    { key: "hijos", label: "Hijos", type: "input", placeholder: "Ej: 0" },
    { key: "hermanos", label: "Cantidad de hermanos", type: "input", placeholder: "Ej: 2" },
    { key: "padresViven", label: "¿Vive con sus padres?", type: "select" },
    {
        key: "observaciones",
        label: "Observaciones familiares",
        type: "textarea",
        placeholder: "Información adicional relevante para entrevistas.",
    },
];

const NAV_SECTIONS = [
    { key: "datos", label: "Datos personales" },
    { key: "marca", label: "Marca profesional" },
    { key: "sobreMi", label: "Sobre mí" },
    { key: "experiencias", label: "Experiencia" },
    { key: "estudios", label: "Formación" },
    { key: "proyectos", label: "Proyectos" },
    { key: "habilidades", label: "Skills" },
    { key: "respuestas", label: "Preguntas frecuentes" },
    { key: "faqs-avatar", label: "FAQs del avatar" },
];

const toText = (value) => (value === null || typeof value === "undefined" ? "" : String(value));
const toBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    const normalized = String(value || "").trim().toLowerCase();
    return ["1", "true", "sí", "si", "yes"].includes(normalized);
};

const normalizeItems = (items, type) => {
    if (!Array.isArray(items)) return [];

    return items.map((item, index) => {
        const safeItem = item || {};
        const id = safeItem.id ?? `${type}-${index}`;

        if (type === "respuestas") {
            return {
                id,
                pregunta: toText(safeItem.pregunta),
                respuesta: toText(safeItem.respuesta),
            };
        }

        return {
            id,
            titulo: toText(
                safeItem.titulo || safeItem.nombre || safeItem.idioma || safeItem.puesto || safeItem.empresa || safeItem.institucion
            ),
            descripcion: toText(
                safeItem.descripcion || safeItem.detalle || safeItem.tecnologias || safeItem.responsabilidades
            ),
            organizacion: toText(safeItem.organizacion || safeItem.empresa || safeItem.institucion || safeItem.entidad),
            ubicacion: toText(safeItem.ubicacion || safeItem.location),
            fechaInicio: toText(safeItem.fechaInicio || safeItem.fecha_inicio || safeItem.desde).slice(0, 7),
            fechaFin: toText(safeItem.fechaFin || safeItem.fecha_fin || safeItem.hasta).slice(0, 7),
            enCurso: toBoolean(safeItem.enCurso ?? safeItem.en_curso ?? safeItem.actual),
            enlace: toText(safeItem.enlace || safeItem.url || safeItem.link || safeItem.github || safeItem.demo_url),
            nivel: toText(safeItem.nivel || safeItem.level),
            categoria: toText(safeItem.categoria || safeItem.category),
            rol: toText(safeItem.rol),
        };
    });
};

const normalizeFamily = (familyData) => {
    const family = Array.isArray(familyData) ? familyData[0] || {} : familyData || {};
    const viveConPadres = family.vive_con_padres;

    return {
        estadoCivil: toText(family.estadoCivil || family.estado_civil),
        hijos: toText(family.hijos),
        hermanos: toText(family.hermanos || family.cantidad_hermanos),
        padresViven:
            viveConPadres === 1 || viveConPadres === true
                ? "Sí"
                : viveConPadres === 0 || viveConPadres === false
                    ? "No"
                    : toText(family.padresViven || family.vivenJuntos),
        observaciones: toText(family.observaciones),
    };
};

const createListItem = (field) => {
    const section = LIST_SECTIONS.find((item) => item.field === field);
    const metaDefaults = (section?.metaFields || []).reduce((accumulator, metaField) => {
        accumulator[metaField.name] = metaField.type === "checkbox" ? false : "";
        return accumulator;
    }, {});

    return {
        id: `${field}-${Date.now()}`,
        titulo: "",
        descripcion: "",
        ...metaDefaults,
    };
};

const normalizeProfileData = (data = {}) => {
    const about = Array.isArray(data.sobre_mi) ? data.sobre_mi[0] || {} : data.sobre_mi || {};

    return {
        ...EMPTY_PROFILE,
        nombre: toText(data.usuario?.nombre),
        apellido: toText(data.usuario?.apellido),
        email: toText(data.usuario?.email),
        telefono: toText(data.usuario?.telefono),
        fechaNacimiento: toText(data.usuario?.fecha_nacimiento).slice(0, 10),
        nacionalidad: toText(data.usuario?.nacionalidad),
        direccion: toText(data.usuario?.direccion),
        resumen: toText(data.usuario?.resumen),
        puestoActual: toText(data.usuario?.puesto_actual),
        objetivoProfesional: toText(data.usuario?.objetivo_profesional),
        disponibilidad: toText(data.usuario?.disponibilidad),
        modalidadPreferida: toText(data.usuario?.modalidad_preferida),
        pretensionSalarial: toText(data.usuario?.pretension_salarial),
        linkedinUrl: toText(data.usuario?.linkedin_url),
        githubUrl: toText(data.usuario?.github_url),
        portfolioUrl: toText(data.usuario?.portfolio_url),
        isPublic: toBoolean(data.usuario?.is_public),
        sobreMi: toText(about.descripcion || data.sobreMi || data.usuario?.resumen),
        experiencias: normalizeItems(data.experiencia_laboral, "experiencias"),
        estudios: normalizeItems(data.educacion, "estudios"),
        cursos: normalizeItems(data.cursos, "cursos"),
        proyectos: normalizeItems(data.proyectos, "proyectos"),
        habilidades: normalizeItems(data.habilidades, "habilidades"),
        idiomas: normalizeItems(data.idiomas, "idiomas"),
        familia: normalizeFamily(data.familia),
        respuestas: normalizeItems(data.respuestas_entrevista, "respuestas"),
    };
};

export default function ProfilePage() {
    const { user } = useAuth();
    const parsedUserId = Number(user?.id ?? user?.userId);
    const userId = Number.isFinite(parsedUserId) ? parsedUserId : null;
    const [profile, setProfile] = useState(null);
    const [openSection, setOpenSection] = useState("sobreMi");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        if (!userId) {
            setError("No se encontró un ID de usuario válido");
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setError(null);
                const data = await userService.getProfile(userId);
                setProfile(normalizeProfileData(data));
            } catch (err) {
                console.error("❌ Error cargando datos:", err);
                setError(err.message || ERROR_MESSAGES.UNKNOWN_ERROR);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId]);

    const completion = useMemo(() => {
        if (!profile) return 0;

        const checklist = [
            profile.nombre,
            profile.apellido,
            profile.email,
            profile.telefono,
            profile.resumen || profile.sobreMi,
            profile.puestoActual,
            profile.objetivoProfesional,
            profile.experiencias.length > 0,
            profile.estudios.length > 0,
            profile.habilidades.length > 0,
            profile.idiomas.length > 0,
            profile.proyectos.length > 0,
            profile.respuestas.length > 0,
        ];

        const completed = checklist.filter(Boolean).length;
        return Math.round((completed / checklist.length) * 100);
    }, [profile]);

    const toggleSection = (section) => {
        setOpenSection((current) => (current === section ? null : section));
    };

    const jumpToSection = (section) => {
        setOpenSection(section);

        if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
                document.getElementById(`section-${section}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            });
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile((current) => ({ ...current, [name]: value }));
    };

    const handleFamilyChange = (e) => {
        const { name, value } = e.target;
        setProfile((current) => ({
            ...current,
            familia: { ...current.familia, [name]: value },
        }));
    };

    const handleAdd = (field) => {
        setProfile((current) => ({
            ...current,
            [field]: [...current[field], createListItem(field)],
        }));
    };

    const handleAddPregunta = (field) => {
        setProfile((current) => ({
            ...current,
            [field]: [...current[field], { id: `${field}-${Date.now()}`, pregunta: "", respuesta: "" }],
        }));
    };

    const handleItemChange = (field, id, name, value) => {
        setProfile((current) => ({
            ...current,
            [field]: current[field].map((item) => (item.id === id ? { ...item, [name]: value } : item)),
        }));
    };

    const handleRemove = (field, id) => {
        setProfile((current) => ({
            ...current,
            [field]: current[field].filter((item) => item.id !== id),
        }));
    };

    const handleLoadFaqTemplates = () => {
        setProfile((current) => {
            const existing = new Set(
                current.respuestas.map((item) => item.pregunta.trim().toLowerCase()).filter(Boolean)
            );
            const suggestions = FAQ_TEMPLATES
                .filter((item) => !existing.has(item.pregunta.toLowerCase()))
                .map((item, index) => ({ id: `faq-${Date.now()}-${index}`, ...item }));

            return {
                ...current,
                respuestas: [...current.respuestas, ...suggestions],
            };
        });
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();

        if (!userId) {
            setError("No se encontró un ID de usuario válido");
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await userService.updateProfile(userId, profile);
            if (result.success) {
                setSuccess(SUCCESS_MESSAGES.PROFILE_SAVED);
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(result.message || "Error al guardar datos");
            }
        } catch (err) {
            console.error("Error guardando datos:", err);
            setError(err.message || ERROR_MESSAGES.UNKNOWN_ERROR);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="profile-page theme-dark">
                <div className="profile-container">
                    <div className="loading">Cargando perfil...</div>
                </div>
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="profile-page theme-dark">
                <div className="profile-container">
                    <div className="error-message">{error}</div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="profile-page theme-dark">
                <div className="profile-container">
                    <div className="error-message">No se encontraron datos del usuario.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page theme-dark">
            <div className="profile-container">
                <section className="profile-hero">
                    <div>
                        <div className="profile-hero-top">
                            <span className="profile-kicker">Panel profesional</span>
                        </div>
                        <h1>Perfil profesional</h1>
                        <p className="profile-subtitle">
                            Organiza tu información de forma clara para que tu presentación se vea mejor y la IA
                            responda con más contexto, confianza y consistencia.
                        </p>
                        <div className="profile-hero-actions">
                            <button type="button" className="save-btn compact" onClick={handleSubmit} disabled={saving}>
                                {saving ? "Guardando..." : "Guardar cambios"}
                            </button>
                            <button type="button" className="profile-ghost-btn" onClick={() => jumpToSection("respuestas")}>
                                Preparar respuestas
                            </button>
                        </div>
                    </div>

                    <div className="profile-summary-card">
                        <span className={`summary-status ${saving ? "is-saving" : ""}`}>
                            {saving ? "Guardando cambios..." : "Edición activa"}
                        </span>
                        <strong>{completion}% completado</strong>
                        <div className="progress-track" aria-hidden="true">
                            <span style={{ width: `${completion}%` }} />
                        </div>
                        <small>
                            {completion < 70
                                ? "Completa más secciones para mejorar la calidad de las respuestas de la IA."
                                : "Tu perfil ya tiene muy buen contexto para generar respuestas sólidas."}
                        </small>
                    </div>
                </section>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="profile-layout">
                    <div className="profile-main">
                        <ProfileSection
                            sectionKey="datos"
                            title="Datos personales"
                            hint="Información básica para identificar tu perfil."
                            isOpen={openSection === "datos"}
                            onToggle={() => toggleSection("datos")}
                        >
                            <div className="profile-grid">
                                <div className="field-group">
                                    <label htmlFor="nombre">Nombre</label>
                                    <input id="nombre" name="nombre" value={profile.nombre} onChange={handleChange} placeholder="Tu nombre" />
                                </div>

                                <div className="field-group">
                                    <label htmlFor="apellido">Apellido</label>
                                    <input id="apellido" name="apellido" value={profile.apellido} onChange={handleChange} placeholder="Tu apellido" />
                                </div>

                                <div className="field-group">
                                    <label htmlFor="email">Email</label>
                                    <input
                                        id="email"
                                        name="email"
                                        value={profile.email}
                                        onChange={handleChange}
                                        placeholder="Correo de contacto"
                                        disabled
                                    />
                                </div>

                                <div className="field-group">
                                    <label htmlFor="telefono">Teléfono</label>
                                    <input
                                        id="telefono"
                                        name="telefono"
                                        value={profile.telefono}
                                        onChange={handleChange}
                                        placeholder="Ej: +54 11 1234 5678"
                                    />
                                </div>

                                <div className="field-group">
                                    <label htmlFor="fechaNacimiento">Fecha de nacimiento</label>
                                    <input id="fechaNacimiento" name="fechaNacimiento" type="date" value={profile.fechaNacimiento} onChange={handleChange} />
                                </div>

                                <div className="field-group">
                                    <label htmlFor="nacionalidad">Nacionalidad</label>
                                    <input
                                        id="nacionalidad"
                                        name="nacionalidad"
                                        value={profile.nacionalidad}
                                        onChange={handleChange}
                                        placeholder="Ej: Argentina"
                                    />
                                </div>

                                <div className="field-group full-width">
                                    <label htmlFor="direccion">Ubicación / dirección</label>
                                    <input
                                        id="direccion"
                                        name="direccion"
                                        value={profile.direccion}
                                        onChange={handleChange}
                                        placeholder="Ciudad, provincia o dirección de referencia"
                                    />
                                </div>

                                <div className="field-group full-width visibility-toggle-wrap">
                                    <label className="visibility-toggle" htmlFor="isPublic">
                                        <span>
                                            <strong>Perfil público</strong>
                                            <small>
                                                Si lo activas, tu perfil aparecerá en Home y podrá encontrarse desde `/search`.
                                            </small>
                                        </span>
                                        <input
                                            id="isPublic"
                                            name="isPublic"
                                            type="checkbox"
                                            checked={!!profile.isPublic}
                                            onChange={(event) => setProfile((current) => ({ ...current, isPublic: event.target.checked }))}
                                        />
                                    </label>
                                </div>
                            </div>

                            <p className="section-note">
                                El correo se toma de tu cuenta y funciona como dato de referencia para el reclutador.
                            </p>
                        </ProfileSection>

                        <ProfileSection
                            sectionKey="marca"
                            title="Marca profesional y enlaces"
                            hint="Resumen ejecutivo, links y datos clave de empleabilidad."
                            isOpen={openSection === "marca"}
                            onToggle={() => toggleSection("marca")}
                        >
                            <div className="profile-grid">
                                <div className="field-group full-width">
                                    <label htmlFor="resumen">Titular profesional</label>
                                    <input
                                        id="resumen"
                                        name="resumen"
                                        value={profile.resumen}
                                        onChange={handleChange}
                                        placeholder="Ej: Analista de datos con enfoque comercial y automatización"
                                    />
                                </div>

                                <div className="field-group">
                                    <label htmlFor="puestoActual">Puesto actual o deseado</label>
                                    <input
                                        id="puestoActual"
                                        name="puestoActual"
                                        value={profile.puestoActual}
                                        onChange={handleChange}
                                        placeholder="Ej: Desarrollador Full Stack"
                                    />
                                </div>

                                <div className="field-group">
                                    <label htmlFor="disponibilidad">Disponibilidad</label>
                                    <select id="disponibilidad" name="disponibilidad" value={profile.disponibilidad} onChange={handleChange}>
                                        <option value="">Seleccionar</option>
                                        <option value="Inmediata">Inmediata</option>
                                        <option value="15 días">15 días</option>
                                        <option value="30 días">30 días</option>
                                        <option value="A convenir">A convenir</option>
                                    </select>
                                </div>

                                <div className="field-group">
                                    <label htmlFor="modalidadPreferida">Modalidad preferida</label>
                                    <select
                                        id="modalidadPreferida"
                                        name="modalidadPreferida"
                                        value={profile.modalidadPreferida}
                                        onChange={handleChange}
                                    >
                                        <option value="">Seleccionar</option>
                                        <option value="Remoto">Remoto</option>
                                        <option value="Híbrido">Híbrido</option>
                                        <option value="Presencial">Presencial</option>
                                        <option value="Flexible">Flexible</option>
                                    </select>
                                </div>

                                <div className="field-group">
                                    <label htmlFor="pretensionSalarial">Pretensión salarial</label>
                                    <input
                                        id="pretensionSalarial"
                                        name="pretensionSalarial"
                                        value={profile.pretensionSalarial}
                                        onChange={handleChange}
                                        placeholder="Ej: A convenir"
                                    />
                                </div>

                                <div className="field-group">
                                    <label htmlFor="linkedinUrl">LinkedIn</label>
                                    <input
                                        id="linkedinUrl"
                                        name="linkedinUrl"
                                        type="url"
                                        value={profile.linkedinUrl}
                                        onChange={handleChange}
                                        placeholder="https://linkedin.com/in/..."
                                    />
                                </div>

                                <div className="field-group">
                                    <label htmlFor="githubUrl">GitHub</label>
                                    <input
                                        id="githubUrl"
                                        name="githubUrl"
                                        type="url"
                                        value={profile.githubUrl}
                                        onChange={handleChange}
                                        placeholder="https://github.com/..."
                                    />
                                </div>

                                <div className="field-group full-width">
                                    <label htmlFor="portfolioUrl">Portfolio o sitio personal</label>
                                    <input
                                        id="portfolioUrl"
                                        name="portfolioUrl"
                                        type="url"
                                        value={profile.portfolioUrl}
                                        onChange={handleChange}
                                        placeholder="https://tuportfolio.com"
                                    />
                                </div>

                                <div className="field-group full-width">
                                    <label htmlFor="objetivoProfesional">Objetivo profesional</label>
                                    <textarea
                                        id="objetivoProfesional"
                                        name="objetivoProfesional"
                                        value={profile.objetivoProfesional}
                                        onChange={handleChange}
                                        placeholder="Describe el tipo de oportunidad que buscas y cómo quieres aportar valor."
                                    />
                                </div>
                            </div>
                        </ProfileSection>

                        <ProfileSection
                            sectionKey="sobreMi"
                            title="Sobre mí"
                            hint="Presentación breve, humana y orientada a valor."
                            isOpen={openSection === "sobreMi"}
                            onToggle={() => toggleSection("sobreMi")}
                        >
                            <div className="field-group">
                                <label htmlFor="sobreMi">Resumen profesional</label>
                                <textarea
                                    id="sobreMi"
                                    name="sobreMi"
                                    value={profile.sobreMi}
                                    onChange={handleChange}
                                    placeholder="Cuenta quién eres, qué haces bien y qué te diferencia."
                                />
                            </div>
                        </ProfileSection>

                        {LIST_SECTIONS.map((section) => (
                            <ProfileListSection
                                key={section.field}
                                section={section}
                                items={profile[section.field]}
                                isOpen={openSection === section.field}
                                onToggle={() => toggleSection(section.field)}
                                onAdd={handleAdd}
                                onChange={handleItemChange}
                                onRemove={handleRemove}
                            />
                        ))}

                        <ProfileSection
                            sectionKey="familia"
                            title="Entorno familiar"
                            hint="Datos complementarios para entrevistas más humanas."
                            isOpen={openSection === "familia"}
                            onToggle={() => toggleSection("familia")}
                        >
                            <div className="family-grid">
                                {FAMILY_FIELDS.map((field) => (
                                    <div
                                        key={field.key}
                                        className={`field-group ${field.type === "textarea" ? "full-width" : ""}`}
                                    >
                                        <label htmlFor={field.key}>{field.label}</label>

                                        {field.type === "select" ? (
                                            <select
                                                id={field.key}
                                                name={field.key}
                                                value={profile.familia[field.key]}
                                                onChange={handleFamilyChange}
                                            >
                                                <option value="">Seleccionar</option>
                                                <option value="Sí">Sí</option>
                                                <option value="No">No</option>
                                            </select>
                                        ) : field.type === "textarea" ? (
                                            <textarea
                                                id={field.key}
                                                name={field.key}
                                                value={profile.familia[field.key]}
                                                onChange={handleFamilyChange}
                                                placeholder={field.placeholder}
                                            />
                                        ) : (
                                            <input
                                                id={field.key}
                                                name={field.key}
                                                value={profile.familia[field.key]}
                                                onChange={handleFamilyChange}
                                                placeholder={field.placeholder}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ProfileSection>

                        <ProfileSection
                            sectionKey="respuestas"
                            title="Preguntas y respuestas"
                            hint="Prepara respuestas frecuentes para entrevistas virtuales."
                            isOpen={openSection === "respuestas"}
                            onToggle={() => toggleSection("respuestas")}
                            badge={profile.respuestas.length}
                        >
                            <div className="section-toolbar">
                                <div className="section-note">
                                    Puedes cargar preguntas frecuentes y luego personalizar tus respuestas en primera persona.
                                </div>
                                <button type="button" className="add-btn" onClick={handleLoadFaqTemplates}>
                                    + Cargar preguntas frecuentes sugeridas
                                </button>
                            </div>

                            {profile.respuestas.length === 0 && (
                                <div className="empty-state">
                                    Añade respuestas base para que tu preparación sea más consistente.
                                </div>
                            )}

                            {profile.respuestas.map((item) => (
                                <div key={item.id} className="sub-item">
                                    <div className="sub-item-header">
                                        <input
                                            placeholder="Pregunta frecuente"
                                            value={item.pregunta}
                                            onChange={(e) => handleItemChange("respuestas", item.id, "pregunta", e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="remove-btn"
                                            onClick={() => handleRemove("respuestas", item.id)}
                                            title="Eliminar"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <textarea
                                        placeholder="Escribe una respuesta clara, concreta y en primera persona, como la dirías en una entrevista."
                                        value={item.respuesta}
                                        onChange={(e) => handleItemChange("respuestas", item.id, "respuesta", e.target.value)}
                                    />
                                </div>
                            ))}

                            <button type="button" className="add-btn" onClick={() => handleAddPregunta("respuestas")}>
                                + Agregar pregunta y respuesta
                            </button>
                        </ProfileSection>

                        <ProfileSection
                            sectionKey="faqs-avatar"
                            title="Respuestas rápidas del avatar (FAQs)"
                            hint="Preguntas que tu avatar responde instantáneamente sin llamar al modelo IA."
                            isOpen={openSection === "faqs-avatar"}
                            onToggle={() => toggleSection("faqs-avatar")}
                        >
                            {userId && <ProfileFaqSection candidateId={userId} />}
                        </ProfileSection>

                        <div className="save-panel">
                            <div>
                                <strong>Perfil listo para potenciar tu asistente</strong>
                                <p>
                                    Cuanto más claro esté tu perfil, más precisas y veloces serán las respuestas de la IA.
                                </p>
                            </div>

                            <button type="button" className="save-btn" onClick={handleSubmit} disabled={saving}>
                                {saving ? "Guardando..." : "Guardar cambios"}
                            </button>
                        </div>
                    </div>

                    <ProfileSidebar
                        profile={profile}
                        completion={completion}
                        sections={NAV_SECTIONS}
                        onJumpToSection={jumpToSection}
                    />
                </div>
            </div>
        </div>
    );
}
