import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import ProfileListSection from "../components/profile/ProfileListSection";
import ProfileSection from "../components/profile/ProfileSection";
import ProfileSidebar from "../components/profile/ProfileSidebar";
import ProfileFaqSection from "../components/profile/ProfileFaqSection";
import ProfileAIContextInspector from "../components/profile/ProfileAIContextInspector";
import ProfileUpdateConfirmCard from "../components/ProfileUpdateConfirmCard";
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
    { key: "cursos", label: "Cursos" },
    { key: "proyectos", label: "Proyectos" },
    { key: "habilidades", label: "Skills" },
    { key: "idiomas", label: "Idiomas" },
    { key: "familia", label: "Entorno familiar" },
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

const extractGithubUsername = (url) => {
    const match = String(url || "").trim().match(/github\.com\/([^/?#]+)/i);
    return match ? match[1] : "";
};

const isGithubProposalEmpty = (proposal) => {
    const hasCandidateFields = Object.keys(proposal?.candidateFields || {}).length > 0;
    const hasSections = Object.values(proposal?.sections || {}).some((rows) => Array.isArray(rows) && rows.length > 0);
    return !hasCandidateFields && !hasSections;
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
    const [openSection, setOpenSection] = useState("datos");
    const [activeSection, setActiveSection] = useState("datos");
    const [expandedRespuestaId, setExpandedRespuestaId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [actionFeedback, setActionFeedback] = useState(null);
    const [showGithubImport, setShowGithubImport] = useState(false);
    const [githubUsername, setGithubUsername] = useState("");
    const [githubImporting, setGithubImporting] = useState(false);
    const [githubProposal, setGithubProposal] = useState(null);
    const [githubImportError, setGithubImportError] = useState("");
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

    const handleOpenGithubImport = () => {
        setGithubUsername(extractGithubUsername(profile?.githubUrl));
        setGithubImportError("");
        setGithubProposal(null);
        setShowGithubImport(true);
    };

    const handleGithubImport = async () => {
        const trimmedUsername = githubUsername.trim();
        if (!trimmedUsername) {
            setGithubImportError("Ingresá tu username de GitHub");
            return;
        }
        setGithubImporting(true);
        setGithubImportError("");
        setGithubProposal(null);
        try {
            const result = await userService.importFromGithub(userId, trimmedUsername);
            setGithubProposal(result.proposal);
        } catch (err) {
            setGithubImportError(err.message || "No se pudo importar desde GitHub. Probá de nuevo.");
        } finally {
            setGithubImporting(false);
        }
    };

    const handleGithubImportSaved = async () => {
        setGithubProposal(null);
        setShowGithubImport(false);
        showActionFeedback("Perfil actualizado con datos de GitHub", "success");
        try {
            const data = await userService.getProfile(userId);
            setProfile(normalizeProfileData(data));
        } catch {
            // El usuario puede refrescar la página manualmente si esto falla.
        }
    };

    const shareLink = userId ? `${window.location.origin}/${userId}` : "";

    const handleCopyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(shareLink);
            showActionFeedback("Link copiado al portapapeles", "success");
        } catch {
            showActionFeedback("No se pudo copiar el link, copialo manualmente", "warning");
        }
    };

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

    const sectionProgressMap = useMemo(() => {
        if (!profile) return {};

        const byLength = (items, target = 1) => Math.min(100, Math.round((items.length / target) * 100));
        const textFill = (value) => Boolean(toText(value).trim());
        const safePercent = (done, total) => (total ? Math.round((done / total) * 100) : 0);
        const validRespuestas = profile.respuestas.filter(
            (item) => item.pregunta.trim().length > 0 && item.respuesta.trim().length > 0
        );

        const datosDone = [
            textFill(profile.nombre),
            textFill(profile.apellido),
            textFill(profile.email),
            textFill(profile.telefono),
            textFill(profile.nacionalidad),
            textFill(profile.direccion),
        ].filter(Boolean).length;

        const marcaDone = [
            textFill(profile.resumen),
            textFill(profile.puestoActual),
            textFill(profile.objetivoProfesional),
            textFill(profile.disponibilidad),
            textFill(profile.modalidadPreferida),
            textFill(profile.linkedinUrl) || textFill(profile.githubUrl) || textFill(profile.portfolioUrl),
        ].filter(Boolean).length;

        return {
            "inspector-ia": completion,
            datos: safePercent(datosDone, 6),
            marca: safePercent(marcaDone, 6),
            sobreMi: textFill(profile.sobreMi) ? 100 : 0,
            experiencias: byLength(profile.experiencias, 2),
            estudios: byLength(profile.estudios, 1),
            cursos: byLength(profile.cursos, 1),
            proyectos: byLength(profile.proyectos, 1),
            habilidades: byLength(profile.habilidades, 4),
            idiomas: byLength(profile.idiomas, 2),
            familia: safePercent(
                [
                    textFill(profile.familia?.estadoCivil),
                    textFill(profile.familia?.hijos),
                    textFill(profile.familia?.hermanos),
                    textFill(profile.familia?.padresViven),
                    textFill(profile.familia?.observaciones),
                ].filter(Boolean).length,
                5
            ),
            respuestas: byLength(validRespuestas, 3),
            "faqs-avatar": 0,
        };
    }, [profile, completion]);

    const sidebarSections = useMemo(
        () =>
            NAV_SECTIONS.map((section) => {
                const progress = sectionProgressMap[section.key] || 0;
                const state = progress >= 95 ? "done" : progress > 0 ? "partial" : "empty";
                return { ...section, progress, state };
            }),
        [sectionProgressMap]
    );

    const currentSectionIndex = useMemo(
        () => sidebarSections.findIndex((section) => section.key === activeSection),
        [sidebarSections, activeSection]
    );

    const currentSection = sidebarSections[currentSectionIndex] || sidebarSections[0] || null;

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

    const setSection = (section) => {
        setOpenSection(section);
        setActiveSection(section);
    };

    const toggleSection = (section) => {
        setSection(section);
    };

    const jumpToSection = (section) => {
        setSection(section);
    };

    const goToAdjacentSection = (direction) => {
        if (!sidebarSections.length) return;
        const fallbackIndex = currentSectionIndex >= 0 ? currentSectionIndex : 0;
        const nextIndex = fallbackIndex + direction;
        if (nextIndex < 0 || nextIndex >= sidebarSections.length) return;
        setSection(sidebarSections[nextIndex].key);
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
            setSection(field);
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
            setSection(field);
            showActionFeedback(`Nuevo ${singularLabel} agregado y sincronizado.`, "success");
        } catch (err) {
            console.error(`Error creando item de ${field}:`, err);
            setProfile((current) => ({
                ...current,
                [field]: [...current[field], createListItem(field)],
            }));
            setSection(field);
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
            const id = `${field}-${Date.now()}`;
            setProfile((current) => ({
                ...current,
                [field]: [...current[field], { id, pregunta: "", respuesta: "" }],
            }));
            setExpandedRespuestaId(id);
            setSection("respuestas");
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
            setExpandedRespuestaId(createdItem.id);
            setSection("respuestas");
            showActionFeedback("Nuevo bloque agregado y sincronizado.", "success");
        } catch (err) {
            console.error("Error creando pregunta/respuesta:", err);
            const id = `${field}-${Date.now()}`;
            setProfile((current) => ({
                ...current,
                [field]: [...current[field], { id, pregunta: "", respuesta: "" }],
            }));
            setExpandedRespuestaId(id);
            setSection("respuestas");
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

        if (field === "respuestas" && expandedRespuestaId === id) {
            setExpandedRespuestaId(null);
        }

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
                showActionFeedback("Perfil guardado correctamente. Tu avatar ya tiene el contexto actualizado.", "success");
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
            <div className="profile-page">
                <div className="profile-container">
                    <div className="profile-loading-skeleton">
                        <div className="skeleton-line skeleton-line--title" />
                        <div className="skeleton-line" />
                        <div className="skeleton-line skeleton-line--short" />
                        <div className="skeleton-grid">
                            <div className="skeleton-card" />
                            <div className="skeleton-card" />
                            <div className="skeleton-card" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="profile-page">
                <div className="profile-container">
                    <div className="error-message">{error}</div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="profile-page">
                <div className="profile-container">
                    <div className="error-message">No se encontraron datos del usuario.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
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
                        <section className="profile-workbench" aria-label="Navegacion de secciones">
                            <div className="profile-section-checklist" role="tablist" aria-label="Secciones del perfil">
                                {sidebarSections.map((section) => (
                                    <button
                                        key={section.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeSection === section.key}
                                        aria-controls={`section-${section.key}`}
                                        className={`profile-checklist-item state-${section.state} ${activeSection === section.key ? "is-active" : ""}`}
                                        onClick={() => jumpToSection(section.key)}
                                    >
                                        {section.state === "done"
                                            ? <CheckCircle2 size={16} strokeWidth={2} />
                                            : <Circle size={16} strokeWidth={2} />}
                                        <span>{section.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="profile-action-strip">
                                <div>
                                    <strong>{currentSection?.label || "Perfil"}</strong>
                                    <small>
                                        {currentSection?.progress || 0}% completado en esta seccion · {completion}% total
                                    </small>
                                </div>

                                <div className="profile-action-strip__controls">
                                    <button
                                        type="button"
                                        className="profile-ghost-btn"
                                        onClick={() => goToAdjacentSection(-1)}
                                        disabled={currentSectionIndex <= 0}
                                    >
                                        Anterior
                                    </button>

                                    <button
                                        type="button"
                                        className="profile-ghost-btn"
                                        onClick={() => goToAdjacentSection(1)}
                                        disabled={currentSectionIndex >= sidebarSections.length - 1}
                                    >
                                        Siguiente
                                    </button>

                                    <Link to="/chat" className="sidebar-primary-btn">
                                        Ir al chat
                                    </Link>

                                    <button type="button" className="save-btn compact" onClick={handleSubmit} disabled={saving}>
                                        {saving ? "Guardando..." : "Guardar"}
                                    </button>
                                </div>
                            </div>
                        </section>

                        {activeSection === "inspector-ia" && (
                            <div id="section-inspector-ia" className="profile-active-panel" role="tabpanel">
                                <ProfileAIContextInspector
                                    completion={completion}
                                    sectionCompletion={aiInspectorData.sectionCompletion}
                                    dataSummary={aiInspectorData.dataSummary}
                                    criticalMissing={aiInspectorData.criticalMissing}
                                    qualityChecklist={aiInspectorData.qualityChecklist}
                                />
                            </div>
                        )}

                        {activeSection === "datos" && <ProfileSection
                            sectionKey="datos"
                            title="Datos personales"
                            hint="Completa primero identidad y contacto para que recruiters puedan ubicarte rápido."
                            isOpen={openSection === "datos"}
                            onToggle={() => toggleSection("datos")}
                        >
                            <div className="profile-section-group">
                                <h3 className="profile-subgroup-title">Identidad</h3>
                                <div className="profile-grid profile-grid--compact">
                                    <div className="field-group">
                                        <label htmlFor="nombre">Nombre</label>
                                        <input id="nombre" name="nombre" value={profile.nombre} onChange={handleChange} placeholder="Tu nombre" />
                                    </div>

                                    <div className="field-group">
                                        <label htmlFor="apellido">Apellido</label>
                                        <input id="apellido" name="apellido" value={profile.apellido} onChange={handleChange} placeholder="Tu apellido" />
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
                                </div>
                            </div>

                            <div className="profile-section-group">
                                <h3 className="profile-subgroup-title">Contacto</h3>
                                <div className="profile-grid profile-grid--compact">
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
                                        <label htmlFor="telefono">Telefono</label>
                                        <input
                                            id="telefono"
                                            name="telefono"
                                            value={profile.telefono}
                                            onChange={handleChange}
                                            placeholder="Ej: +54 11 1234 5678"
                                        />
                                    </div>

                                    <div className="field-group full-width">
                                        <label htmlFor="direccion">Ubicacion / direccion</label>
                                        <input
                                            id="direccion"
                                            name="direccion"
                                            value={profile.direccion}
                                            onChange={handleChange}
                                            placeholder="Ciudad, provincia o direccion de referencia"
                                        />
                                    </div>

                                    <div className="field-group full-width visibility-toggle-wrap">
                                        <label className="visibility-toggle" htmlFor="isPublic">
                                            <span>
                                                <strong>Perfil publico</strong>
                                                <small>
                                                    Si lo activas, tu perfil aparecera en Home y podra encontrarse desde /search.
                                                </small>
                                            </span>
                                            <input
                                                id="isPublic"
                                                name="isPublic"
                                                type="checkbox"
                                                checked={!!profile.isPublic}
                                                onChange={(event) => {
                                                    setProfile((current) => ({ ...current, isPublic: event.target.checked }));
                                                    setIsDirty(true);
                                                }}
                                            />
                                        </label>
                                    </div>

                                    <div className="field-group full-width share-link-wrap">
                                        <label htmlFor="shareLink">Link para compartir tu chat de IA</label>
                                        <div className="share-link-row">
                                            <input id="shareLink" value={shareLink} readOnly />
                                            <button type="button" onClick={handleCopyShareLink}>
                                                Copiar
                                            </button>
                                        </div>
                                        {!profile.isPublic && (
                                            <small className="share-link-hint">
                                                Activá "Perfil público" arriba para que cualquiera que abra este link pueda chatear.
                                            </small>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <p className="section-note">
                                El correo se toma de tu cuenta y funciona como dato de referencia para el reclutador.
                            </p>
                        </ProfileSection>}

                        {activeSection === "marca" && <ProfileSection
                            sectionKey="marca"
                            title="Marca profesional y enlaces"
                            hint="Define tu posicionamiento profesional antes de detallar toda la trayectoria."
                            isOpen={openSection === "marca"}
                            onToggle={() => toggleSection("marca")}
                        >
                            <div className="profile-section-group">
                                <h3 className="profile-subgroup-title">Posicionamiento</h3>
                                <div className="profile-grid">
                                    <div className="field-group full-width">
                                        <label htmlFor="resumen">Titular profesional</label>
                                        <input
                                            id="resumen"
                                            name="resumen"
                                            value={profile.resumen}
                                            onChange={handleChange}
                                            placeholder="Ej: Analista de datos con enfoque comercial y automatizacion"
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

                                    <div className="field-group full-width">
                                        <label htmlFor="objetivoProfesional">Objetivo profesional</label>
                                        <textarea
                                            id="objetivoProfesional"
                                            name="objetivoProfesional"
                                            value={profile.objetivoProfesional}
                                            onChange={handleChange}
                                            placeholder="Describe el tipo de oportunidad que buscas y como quieres aportar valor."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="profile-section-group">
                                <h3 className="profile-subgroup-title">Condiciones</h3>
                                <div className="profile-grid profile-grid--compact">
                                    <div className="field-group">
                                        <label htmlFor="disponibilidad">Disponibilidad</label>
                                        <select id="disponibilidad" name="disponibilidad" value={profile.disponibilidad} onChange={handleChange}>
                                            <option value="">Seleccionar</option>
                                            <option value="Inmediata">Inmediata</option>
                                            <option value="15 dias">15 dias</option>
                                            <option value="30 dias">30 dias</option>
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
                                            <option value="Hibrido">Hibrido</option>
                                            <option value="Presencial">Presencial</option>
                                            <option value="Flexible">Flexible</option>
                                        </select>
                                    </div>

                                    <div className="field-group full-width">
                                        <label htmlFor="pretensionSalarial">Pretension salarial</label>
                                        <input
                                            id="pretensionSalarial"
                                            name="pretensionSalarial"
                                            value={profile.pretensionSalarial}
                                            onChange={handleChange}
                                            placeholder="Ej: A convenir"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="profile-section-group">
                                <h3 className="profile-subgroup-title">Links de validacion</h3>
                                <div className="profile-grid profile-grid--compact">
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
                                        <button
                                            type="button"
                                            className="github-import-btn"
                                            onClick={handleOpenGithubImport}
                                        >
                                            Importar datos desde GitHub
                                        </button>
                                    </div>

                                    {showGithubImport && (
                                        <div className="field-group full-width github-import-panel">
                                            <label htmlFor="githubImportUsername">Tu username de GitHub</label>
                                            <div className="github-import-row">
                                                <input
                                                    id="githubImportUsername"
                                                    value={githubUsername}
                                                    onChange={(e) => setGithubUsername(e.target.value)}
                                                    placeholder="ej: octocat"
                                                    disabled={githubImporting}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleGithubImport}
                                                    disabled={githubImporting}
                                                >
                                                    {githubImporting ? "Buscando…" : "Buscar"}
                                                </button>
                                            </div>

                                            {githubImportError && <p className="github-import-error">{githubImportError}</p>}

                                            {githubProposal && (
                                                isGithubProposalEmpty(githubProposal) ? (
                                                    <p className="github-import-empty">
                                                        No encontramos datos nuevos para proponer desde ese perfil de GitHub.
                                                    </p>
                                                ) : (
                                                    <ProfileUpdateConfirmCard
                                                        userId={userId}
                                                        proposal={githubProposal}
                                                        onSaved={handleGithubImportSaved}
                                                        onDismiss={() => setGithubProposal(null)}
                                                    />
                                                )
                                            )}
                                        </div>
                                    )}

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
                                </div>
                            </div>
                        </ProfileSection>}

                        {activeSection === "sobreMi" && <ProfileSection
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
                        </ProfileSection>}

                        {LIST_SECTIONS.filter((section) => section.field === activeSection).map((section) => (
                            <ProfileListSection
                                key={section.field}
                                section={section}
                                items={profile[section.field]}
                                isOpen={openSection === section.field}
                                onToggle={() => toggleSection(section.field)}
                                onFocusSection={setActiveSection}
                                onAdd={handleAdd}
                                onChange={handleItemChange}
                                onRemove={handleRemove}
                            />
                        ))}

                        {activeSection === "familia" && <ProfileSection
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
                        </ProfileSection>}

                        {activeSection === "respuestas" && <ProfileSection
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

                            {profile.respuestas.length > 1 && (
                                <p className="section-note">Edita una respuesta por vez para enfocarte en claridad y tono.</p>
                            )}

                            {profile.respuestas.map((item) => (
                                <article key={item.id} className={`sub-item ${expandedRespuestaId === item.id ? "is-expanded" : ""}`}>
                                    <div className="sub-item-header">
                                        <button
                                            type="button"
                                            className="sub-item-summary"
                                            onClick={() => {
                                                setExpandedRespuestaId((current) => (current === item.id ? null : item.id));
                                                setActiveSection("respuestas");
                                            }}
                                        >
                                            <span
                                                className={`item-quality ${(item.pregunta.trim() && item.respuesta.trim()) ? "item-quality--ok" : "item-quality--warn"}`}
                                            >
                                                {(item.pregunta.trim() && item.respuesta.trim()) ? "Respuesta lista" : "Completar respuesta"}
                                            </span>
                                            <strong className="sub-item-main-title">
                                                {item.pregunta.trim() || "Nueva pregunta frecuente"}
                                            </strong>
                                        </button>

                                        <button
                                            type="button"
                                            className="item-action-btn"
                                            onClick={() => {
                                                setExpandedRespuestaId((current) => (current === item.id ? null : item.id));
                                                setActiveSection("respuestas");
                                            }}
                                        >
                                            {expandedRespuestaId === item.id ? "Cerrar" : "Editar"}
                                        </button>
                                        <button
                                            type="button"
                                            className="item-action-btn item-action-btn--danger"
                                            onClick={() => handleRemove("respuestas", item.id)}
                                            title="Eliminar"
                                        >
                                            Eliminar
                                        </button>
                                    </div>

                                    {expandedRespuestaId === item.id && (
                                        <div className="sub-item-editor">
                                            <div className="field-group">
                                                <label>Pregunta frecuente</label>
                                                <input
                                                    placeholder="Pregunta frecuente"
                                                    value={item.pregunta}
                                                    onChange={(e) => handleItemChange("respuestas", item.id, "pregunta", e.target.value)}
                                                />
                                            </div>

                                            <div className="field-group">
                                                <label>Respuesta en primera persona</label>
                                                <textarea
                                                    placeholder="Escribe una respuesta clara, concreta y en primera persona, como la dirias en una entrevista."
                                                    value={item.respuesta}
                                                    onChange={(e) => handleItemChange("respuestas", item.id, "respuesta", e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </article>
                            ))}

                            {profile.respuestas.length > 0 && expandedRespuestaId === null && (
                                <button
                                    type="button"
                                    className="add-btn add-btn--ghost"
                                    onClick={() => setExpandedRespuestaId(profile.respuestas[0].id)}
                                >
                                    Editar primera respuesta
                                </button>
                            )}

                            <button type="button" className="add-btn" onClick={() => handleAddPregunta("respuestas")}>
                                + Agregar pregunta y respuesta
                            </button>
                        </ProfileSection>}

                        {activeSection === "faqs-avatar" && <ProfileSection
                            sectionKey="faqs-avatar"
                            title="Respuestas rápidas del avatar (FAQs)"
                            hint="Preguntas que tu avatar responde instantáneamente sin llamar al modelo IA."
                            isOpen={openSection === "faqs-avatar"}
                            onToggle={() => toggleSection("faqs-avatar")}
                        >
                            {userId && <ProfileFaqSection candidateId={userId} />}
                        </ProfileSection>}

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
                        sections={sidebarSections}
                        activeSection={activeSection}
                        onJumpToSection={jumpToSection}
                    />
                </div>
            </div>
        </div>
    );
}
