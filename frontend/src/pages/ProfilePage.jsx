import React, { useEffect, useMemo, useRef, useState } from "react";
import ProfileListSection from "../components/profile/ProfileListSection";
import ProfileSection from "../components/profile/ProfileSection";
import ProfileSidebar from "../components/profile/ProfileSidebar";
import ProfileFaqSection from "../components/profile/ProfileFaqSection";
import ProfileAIContextInspector from "../components/profile/ProfileAIContextInspector";
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
    { key: "inspector-ia", label: "Inspector IA" },
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

const SECTION_KEY_BY_FIELD = {
    experiencias: "experiencia_laboral",
    estudios: "educacion",
    cursos: "cursos",
    proyectos: "proyectos",
    habilidades: "habilidades",
    idiomas: "idiomas",
    respuestas: "respuestas_entrevista",
};

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

const createInitialItemForField = (field) => {
    if (field === "respuestas") {
        return {
            id: `${field}-${Date.now()}`,
            pregunta: "Nueva pregunta frecuente",
            respuesta: "Completa tu respuesta en primera persona.",
        };
    }

    const baseItem = createListItem(field);
    const requiredDefaults = {
        experiencias: {
            titulo: "Nuevo puesto",
            organizacion: "Nueva empresa",
        },
        estudios: {
            titulo: "Nuevo estudio",
            organizacion: "Nueva institucion",
        },
        cursos: {
            titulo: "Nuevo curso",
        },
        proyectos: {
            titulo: "Nuevo proyecto",
        },
        habilidades: {
            titulo: "Nueva habilidad",
        },
        idiomas: {
            titulo: "Nuevo idioma",
        },
    };

    return {
        ...baseItem,
        ...(requiredDefaults[field] || {}),
    };
};

const buildSectionPayload = (field, item = {}) => {
    switch (field) {
        case "experiencias":
            return {
                empresa: item.organizacion || item.titulo,
                puesto: item.titulo,
                descripcion: item.descripcion,
                fecha_inicio: item.fechaInicio || null,
                fecha_fin: item.enCurso ? null : item.fechaFin || null,
                actualmente: Boolean(item.enCurso),
            };
        case "estudios":
            return {
                institucion: item.organizacion || "Institucion",
                titulo: item.titulo,
                nivel: item.descripcion,
                fecha_inicio: item.fechaInicio || null,
                fecha_fin: item.enCurso ? null : item.fechaFin || null,
            };
        case "cursos":
            return {
                nombre: item.titulo,
                institucion: item.organizacion || null,
                descripcion: item.descripcion || null,
                fecha_inicio: item.fechaInicio || null,
                fecha_fin: item.enCurso ? null : item.fechaFin || null,
                certificado_url: item.enlace || null,
            };
        case "proyectos":
            return {
                nombre: item.titulo,
                descripcion: item.descripcion || null,
                tecnologias: item.rol || null,
                url: item.enlace || null,
                fecha_inicio: item.fechaInicio || null,
                fecha_fin: item.enCurso ? null : item.fechaFin || null,
            };
        case "habilidades":
            return {
                nombre: item.titulo,
                categoria: item.categoria || null,
                nivel: item.nivel || item.descripcion || null,
            };
        case "idiomas":
            return {
                idioma: item.titulo,
                nivel: item.nivel || item.descripcion || null,
            };
        case "respuestas":
            return {
                pregunta: item.pregunta,
                respuesta: item.respuesta,
            };
        default:
            return item;
    }
};

const normalizeSectionItemFromApi = (field, apiItem) => {
    if (!apiItem) return null;
    const [normalizedItem] = normalizeItems([apiItem], field);
    return normalizedItem || null;
};

const isPersistedItemId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

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
    const [isDirty, setIsDirty] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [actionFeedback, setActionFeedback] = useState(null);
    const feedbackTimerRef = useRef(null);

    const showActionFeedback = (message, type = "info") => {
        setActionFeedback({ message, type });
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = window.setTimeout(() => setActionFeedback(null), 2400);
    };

    useEffect(() => {
        return () => window.clearTimeout(feedbackTimerRef.current);
    }, []);

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
                setIsDirty(false);
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

    const aiInspectorData = useMemo(() => {
        if (!profile) {
            return {
                sectionCompletion: [],
                dataSummary: [],
                criticalMissing: [],
                qualityChecklist: [],
            };
        }

        const safePercent = (done, total) => (total === 0 ? 0 : Math.round((done / total) * 100));

        const validRespuestas = profile.respuestas.filter(
            (item) => item.pregunta.trim().length > 0 && item.respuesta.trim().length > 0
        );

        const sectionCompletion = [
            {
                key: "datos",
                label: "Datos personales",
                value: safePercent(
                    [
                        profile.nombre,
                        profile.apellido,
                        profile.email,
                        profile.telefono,
                        profile.nacionalidad,
                        profile.direccion,
                    ].filter(Boolean).length,
                    6
                ),
            },
            {
                key: "marca",
                label: "Marca profesional",
                value: safePercent(
                    [
                        profile.resumen,
                        profile.puestoActual,
                        profile.objetivoProfesional,
                        profile.disponibilidad,
                        profile.modalidadPreferida,
                        profile.linkedinUrl || profile.githubUrl || profile.portfolioUrl,
                    ].filter(Boolean).length,
                    6
                ),
            },
            {
                key: "sobreMi",
                label: "Sobre mi",
                value: safePercent(profile.sobreMi.trim().length >= 90 ? 1 : 0, 1),
            },
            {
                key: "experiencias",
                label: "Experiencia",
                value: safePercent(
                    profile.experiencias.filter(
                        (item) => item.titulo.trim() && item.descripcion.trim() && item.organizacion.trim()
                    ).length,
                    Math.max(profile.experiencias.length, 1)
                ),
            },
            {
                key: "habilidades",
                label: "Habilidades",
                value: safePercent(Math.min(profile.habilidades.length, 5), 5),
            },
            {
                key: "respuestas",
                label: "Preguntas y respuestas",
                value: safePercent(Math.min(validRespuestas.length, 3), 3),
            },
        ];

        const dataSummary = [
            { key: "experiencias", label: "Experiencias", value: profile.experiencias.length },
            { key: "estudios", label: "Estudios", value: profile.estudios.length },
            { key: "proyectos", label: "Proyectos", value: profile.proyectos.length },
            { key: "habilidades", label: "Habilidades", value: profile.habilidades.length },
            { key: "idiomas", label: "Idiomas", value: profile.idiomas.length },
            { key: "respuestas", label: "Respuestas preparadas", value: validRespuestas.length },
        ];

        const criticalMissing = [];

        if (!profile.nombre || !profile.apellido) criticalMissing.push("Nombre y apellido");
        if (!profile.telefono) criticalMissing.push("Telefono de contacto");
        if (!profile.puestoActual) criticalMissing.push("Puesto actual o deseado");
        if (!profile.sobreMi?.trim()) criticalMissing.push("Resumen sobre mi");
        if (profile.experiencias.length === 0) criticalMissing.push("Al menos una experiencia laboral");
        if (profile.habilidades.length < 3) criticalMissing.push("Minimo 3 habilidades clave");
        if (validRespuestas.length < 2) criticalMissing.push("Minimo 2 respuestas de entrevista completas");

        const qualityChecklist = [
            {
                key: "about-depth",
                done: profile.sobreMi.trim().length >= 120,
                title: "Resumen personal con profundidad",
                help: "Recomendado: al menos 120 caracteres con fortalezas y enfoque profesional.",
            },
            {
                key: "experience-evidence",
                done: profile.experiencias.some((item) => item.descripcion.trim().length >= 90),
                title: "Experiencia con evidencia de impacto",
                help: "Incluye logros medibles o resultados para mejorar la credibilidad del avatar.",
            },
            {
                key: "goal-alignment",
                done: profile.objetivoProfesional.trim().length >= 80,
                title: "Objetivo profesional claro",
                help: "Ayuda a que la IA mantenga consistencia al hablar de motivacion y busqueda.",
            },
            {
                key: "faq-coverage",
                done: validRespuestas.length >= 3,
                title: "Cobertura de preguntas frecuentes",
                help: "Con 3 o mas respuestas, el chat resuelve dudas comunes con menos ambiguedad.",
            },
            {
                key: "links-proof",
                done: Boolean(profile.linkedinUrl || profile.githubUrl || profile.portfolioUrl),
                title: "Enlaces de respaldo",
                help: "Agregar LinkedIn, GitHub o portfolio mejora validacion y confianza del recruiter.",
            },
        ];

        return { sectionCompletion, dataSummary, criticalMissing, qualityChecklist };
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
        setIsDirty(true);
    };

    const handleFamilyChange = (e) => {
        const { name, value } = e.target;
        setProfile((current) => ({
            ...current,
            familia: { ...current.familia, [name]: value },
        }));
        setIsDirty(true);
    };

    const handleAdd = async (field) => {
        const singularLabel = LIST_SECTIONS.find((section) => section.field === field)?.singular || "elemento";
        const newItem = createInitialItemForField(field);
        const sectionKey = SECTION_KEY_BY_FIELD[field];

        if (!userId || !sectionKey) {
            setProfile((current) => ({
                ...current,
                [field]: [...current[field], createListItem(field)],
            }));
            setIsDirty(true);
            showActionFeedback(`Nuevo ${singularLabel} agregado.`, "success");
            return;
        }

        showActionFeedback(`Creando ${singularLabel}...`, "info");

        try {
            const payload = buildSectionPayload(field, newItem);
            const result = await userService.createSectionItem(userId, sectionKey, payload);
            const createdItem = normalizeSectionItemFromApi(field, result?.item) || newItem;

            setProfile((current) => ({
                ...current,
                [field]: [...current[field], createdItem],
            }));
            showActionFeedback(`Nuevo ${singularLabel} agregado y sincronizado.`, "success");
        } catch (err) {
            console.error(`Error creando item de ${field}:`, err);
            setProfile((current) => ({
                ...current,
                [field]: [...current[field], createListItem(field)],
            }));
            setIsDirty(true);
            showActionFeedback(
                `No se pudo sincronizar al instante. Puedes completar y guardar al final.`,
                "warning"
            );
        }
    };

    const handleAddPregunta = async (field) => {
        const newItem = createInitialItemForField(field);
        const sectionKey = SECTION_KEY_BY_FIELD[field];

        if (!userId || !sectionKey) {
            setProfile((current) => ({
                ...current,
                [field]: [...current[field], { id: `${field}-${Date.now()}`, pregunta: "", respuesta: "" }],
            }));
            setIsDirty(true);
            showActionFeedback("Nuevo bloque de pregunta y respuesta agregado.", "success");
            return;
        }

        showActionFeedback("Creando bloque de pregunta y respuesta...", "info");

        try {
            const payload = buildSectionPayload(field, newItem);
            const result = await userService.createSectionItem(userId, sectionKey, payload);
            const createdItem = normalizeSectionItemFromApi(field, result?.item) || newItem;

            setProfile((current) => ({
                ...current,
                [field]: [...current[field], createdItem],
            }));
            showActionFeedback("Nuevo bloque agregado y sincronizado.", "success");
        } catch (err) {
            console.error("Error creando pregunta/respuesta:", err);
            setProfile((current) => ({
                ...current,
                [field]: [...current[field], { id: `${field}-${Date.now()}`, pregunta: "", respuesta: "" }],
            }));
            setIsDirty(true);
            showActionFeedback(
                "No se pudo sincronizar al instante. Puedes completar y guardar al final.",
                "warning"
            );
        }
    };

    const handleItemChange = (field, id, name, value) => {
        setProfile((current) => ({
            ...current,
            [field]: current[field].map((item) => (item.id === id ? { ...item, [name]: value } : item)),
        }));
        setIsDirty(true);
    };

    const handleRemove = async (field, id) => {
        const sectionKey = SECTION_KEY_BY_FIELD[field];
        const shouldDeleteRemotely = Boolean(userId && sectionKey && isPersistedItemId(id));
        let removedItem = null;

        setProfile((current) => {
            removedItem = current[field].find((item) => item.id === id) || null;
            return {
                ...current,
                [field]: current[field].filter((item) => item.id !== id),
            };
        });

        if (!shouldDeleteRemotely) {
            setIsDirty(true);
            showActionFeedback("Elemento eliminado de la seccion.", "warning");
            return;
        }

        showActionFeedback("Eliminando elemento...", "info");

        try {
            await userService.deleteSectionItem(userId, sectionKey, Number(id));
            showActionFeedback("Elemento eliminado y sincronizado.", "success");
        } catch (err) {
            console.error(`Error eliminando item de ${field}:`, err);
            if (removedItem) {
                setProfile((current) => ({
                    ...current,
                    [field]: [...current[field], removedItem],
                }));
            }
            setError(err.message || "No se pudo eliminar el elemento.");
            showActionFeedback("No se pudo eliminar en servidor. Se restauró el item.", "warning");
        }
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
        setIsDirty(true);
        showActionFeedback("Se cargaron preguntas sugeridas para completar respuestas.", "success");
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
                setIsDirty(false);
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
                            {saving ? "Guardando cambios..." : isDirty ? "Cambios sin guardar" : "Sin cambios pendientes"}
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

                {actionFeedback && <div className={`info-message is-${actionFeedback.type}`}>{actionFeedback.message}</div>}

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="profile-layout">
                    <div className="profile-main">
                        <ProfileAIContextInspector
                            completion={completion}
                            sectionCompletion={aiInspectorData.sectionCompletion}
                            dataSummary={aiInspectorData.dataSummary}
                            criticalMissing={aiInspectorData.criticalMissing}
                            qualityChecklist={aiInspectorData.qualityChecklist}
                        />

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
                                    <strong>Prepara tus respuestas base</strong>
                                    <p>
                                        Incluye preguntas tipicas de entrevista para que el chat responda con mayor
                                        consistencia y menos ambiguedad.
                                    </p>
                                </div>
                            )}

                            {profile.respuestas.map((item) => (
                                <div key={item.id} className="sub-item">
                                    <div className="sub-item-header">
                                        <span
                                            className={`item-quality ${(item.pregunta.trim() && item.respuesta.trim()) ? "item-quality--ok" : "item-quality--warn"}`}
                                        >
                                            {(item.pregunta.trim() && item.respuesta.trim()) ? "Respuesta lista" : "Completar respuesta"}
                                        </span>
                                        <input
                                            placeholder="Pregunta frecuente"
                                            value={item.pregunta}
                                            onChange={(e) => handleItemChange("respuestas", item.id, "pregunta", e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="item-action-btn item-action-btn--danger"
                                            onClick={() => handleRemove("respuestas", item.id)}
                                            title="Eliminar"
                                        >
                                            Eliminar
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
