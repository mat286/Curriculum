import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onboarding } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./OnboardingWizard.css";

const TOTAL_STEPS = 5;

const PHOTO_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const CV_ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
];

const getUserId = (user) => user?.id || user?.userId || user?.googleId || null;

const parseBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "si" || normalized === "yes";
};

const getInitialStep = (user, userId) => {
    const candidateStep = Number(
        user?.onboarding_step ?? user?.onboardingStep ?? user?.current_onboarding_step ?? user?.currentOnboardingStep ?? 1
    );

    const backendStep = Number.isFinite(candidateStep) && candidateStep >= 1 && candidateStep <= TOTAL_STEPS ? candidateStep : 1;

    if (!userId) return backendStep;

    const localStep = Number(localStorage.getItem(`onboarding_step_${userId}`));
    if (Number.isFinite(localStep) && localStep >= 1 && localStep <= TOTAL_STEPS) {
        return Math.max(backendStep, localStep);
    }

    return backendStep;
};

const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado."));
        reader.readAsDataURL(file);
    });

export default function OnboardingWizard() {
    const navigate = useNavigate();
    const { user, updateUser, markOnboardingCompleted } = useAuth();

    const userId = useMemo(() => getUserId(user), [user]);
    const initialStep = useMemo(() => getInitialStep(user, userId), [user, userId]);

    const [currentStep, setCurrentStep] = useState(initialStep);
    const [error, setError] = useState("");

    const [savingStep, setSavingStep] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [processingCv, setProcessingCv] = useState(false);
    const [completing, setCompleting] = useState(false);

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState("");

    const [basicData, setBasicData] = useState({
        nombre: user?.nombre || "",
        puestoActual: user?.puestoActual || user?.puesto_actual || "",
        resumen: user?.resumen || "",
    });

    const [cvFile, setCvFile] = useState(null);
    const [cvText, setCvText] = useState("");
    const [isPublic, setIsPublic] = useState(parseBoolean(user?.isPublic ?? user?.is_public));

    useEffect(() => {
        setCurrentStep(initialStep);
    }, [initialStep]);

    useEffect(() => {
        document.body.classList.add("modal-open");
        return () => {
            document.body.classList.remove("modal-open");
        };
    }, []);

    useEffect(() => {
        if (!photoFile) {
            setPhotoPreview("");
            return;
        }

        const previewUrl = URL.createObjectURL(photoFile);
        setPhotoPreview(previewUrl);

        return () => URL.revokeObjectURL(previewUrl);
    }, [photoFile]);

    const persistLocalStep = useCallback(
        (step) => {
            if (!userId) return;
            localStorage.setItem(`onboarding_step_${userId}`, String(step));
        },
        [userId]
    );

    const saveStep = useCallback(
        async (step, data = {}) => {
            if (!userId) {
                throw new Error("No se pudo identificar al usuario para guardar el progreso.");
            }

            setSavingStep(true);
            setError("");

            try {
                const response = await onboarding.saveStep(userId, step, data);
                if (response?.user) {
                    updateUser(response.user);
                }
                persistLocalStep(step);
                return response;
            } catch (apiError) {
                setError(apiError?.message || "No se pudo guardar el progreso del onboarding.");
                throw apiError;
            } finally {
                setSavingStep(false);
            }
        },
        [persistLocalStep, updateUser, userId]
    );

    const goToStep = useCallback(
        (step) => {
            const nextStep = Math.max(1, Math.min(TOTAL_STEPS, step));
            setCurrentStep(nextStep);
            persistLocalStep(nextStep);
        },
        [persistLocalStep]
    );

    const handleWelcomeContinue = async () => {
        await saveStep(1, { started: true });
        goToStep(2);
    };

    const handleWelcomeSkip = async () => {
        await saveStep(1, { skippedWelcome: true });
        goToStep(2);
    };

    const validatePhoto = (file) => {
        if (!file) {
            return "Selecciona una foto para continuar o usa el botón de saltear.";
        }
        if (!PHOTO_ALLOWED_TYPES.includes(file.type)) {
            return "Formato no válido. Usa JPG, PNG o WEBP.";
        }
        if (file.size > PHOTO_MAX_SIZE_BYTES) {
            return "La foto supera el tamaño máximo de 5MB.";
        }
        return "";
    };

    const handlePhotoUpload = async () => {
        const validationError = validatePhoto(photoFile);
        if (validationError) {
            setError(validationError);
            return;
        }

        setUploadingPhoto(true);
        setError("");

        try {
            const uploadResponse = await onboarding.uploadPhoto(userId, photoFile);
            await saveStep(2, {
                photoUploaded: true,
                photoName: photoFile.name,
                photoUrl: uploadResponse?.photoUrl,
            });
            if (uploadResponse?.user) {
                updateUser(uploadResponse.user);
            }
            goToStep(3);
        } catch (apiError) {
            setError(apiError?.message || "No se pudo subir la foto de perfil.");
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handlePhotoSkip = async () => {
        await saveStep(2, { photoUploaded: false, skippedPhoto: true });
        goToStep(3);
    };

    const validateBasicData = () => {
        const nameLength = basicData.nombre.trim().length;
        const roleLength = basicData.puestoActual.trim().length;

        if (nameLength < 2 || nameLength > 100) {
            return "El nombre debe tener entre 2 y 100 caracteres.";
        }

        if (roleLength > 150) {
            return "El puesto actual no puede superar los 150 caracteres.";
        }

        return "";
    };

    const handleBasicDataNext = async () => {
        const validationError = validateBasicData();
        if (validationError) {
            setError(validationError);
            return;
        }

        await saveStep(3, {
            nombre: basicData.nombre.trim(),
            puestoActual: basicData.puestoActual.trim(),
            resumen: basicData.resumen.trim(),
        });

        updateUser({
            ...user,
            nombre: basicData.nombre.trim(),
            puestoActual: basicData.puestoActual.trim(),
            resumen: basicData.resumen.trim(),
        });

        goToStep(4);
    };

    const validateCv = () => {
        if (!cvFile && !cvText.trim()) {
            return "Sube un CV o pega el texto para procesarlo.";
        }

        if (cvFile && !CV_ALLOWED_TYPES.includes(cvFile.type)) {
            return "Formato de CV no compatible. Usa PDF, DOC, DOCX o TXT.";
        }

        return "";
    };

    const handleProcessCv = async () => {
        const validationError = validateCv();
        if (validationError) {
            setError(validationError);
            return;
        }

        setProcessingCv(true);
        setError("");

        try {
            const payload = {
                cvText: cvText.trim(),
                cvFileName: cvFile?.name || null,
                cvFileType: cvFile?.type || null,
                cvFileSize: cvFile?.size || null,
            };

            if (cvFile) {
                payload.cvFileContent = await readFileAsDataUrl(cvFile);
            }

            await saveStep(4, payload);
            goToStep(5);
        } catch (apiError) {
            setError(apiError?.message || "No se pudo procesar el CV.");
        } finally {
            setProcessingCv(false);
        }
    };

    const handleComplete = async (publishProfile) => {
        setCompleting(true);
        setError("");

        try {
            await saveStep(5, {
                isPublic: publishProfile,
                onboardingDecision: publishProfile ? "activate" : "save-for-later",
            });
            await onboarding.complete(userId);

            markOnboardingCompleted(true, {
                ...(user || {}),
                onboarding_completed: 1,
                onboardingCompleted: true,
                isPublic: publishProfile,
                is_public: publishProfile ? 1 : 0,
            });

            if (userId) {
                localStorage.removeItem(`onboarding_step_${userId}`);
            }

            navigate("/perfil", { replace: true });
        } catch (apiError) {
            setError(apiError?.message || "No se pudo completar el onboarding.");
        } finally {
            setCompleting(false);
        }
    };

    const isBusy = savingStep || uploadingPhoto || processingCv || completing;
    const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);

    return (
        <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Onboarding de candidato">
            <div className="onboarding-card">
                <header className="onboarding-header">
                    <div>
                        <h1 className="onboarding-title">Onboarding de tu perfil</h1>
                        <p className="onboarding-subtitle">Paso {currentStep} de {TOTAL_STEPS}</p>
                    </div>
                    <div className="onboarding-progress-wrap" aria-label={`Progreso ${progressPercent}%`}>
                        <div className="onboarding-progress-bar" style={{ width: `${progressPercent}%` }} />
                    </div>
                </header>

                <ol className="onboarding-stepper" aria-label="Indicador de pasos">
                    {Array.from({ length: TOTAL_STEPS }, (_, index) => {
                        const stepNumber = index + 1;
                        const isActive = stepNumber === currentStep;
                        const isDone = stepNumber < currentStep;

                        return (
                            <li
                                key={stepNumber}
                                className={`onboarding-step-dot ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
                            >
                                {stepNumber}
                            </li>
                        );
                    })}
                </ol>

                {error && <div className="onboarding-error">{error}</div>}

                <section key={currentStep} className="onboarding-step-card onboarding-step-enter">
                    {currentStep === 1 && (
                        <div className="onboarding-step-content">
                            <h2>¡Bienvenido a CV Conversacional!</h2>
                            <p>
                                Vas a crear un perfil inteligente que combina CV, narrativa profesional y un avatar conversacional
                                para recruiters.
                            </p>
                            <div className="onboarding-actions">
                                <button className="wizard-primary" onClick={handleWelcomeContinue} disabled={isBusy}>
                                    {isBusy ? "Guardando..." : "Comenzar"}
                                </button>
                                <button className="wizard-secondary" onClick={handleWelcomeSkip} disabled={isBusy}>
                                    Saltear por ahora
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="onboarding-step-content">
                            <h2>Foto de perfil</h2>
                            <p>Sube una foto para generar mayor confianza y reconocimiento visual de tu perfil.</p>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
                                className="wizard-input"
                                disabled={isBusy}
                            />

                            {photoPreview && (
                                <div className="photo-preview-wrap">
                                    <img src={photoPreview} alt="Previsualización de foto" className="photo-preview" />
                                </div>
                            )}

                            <div className="onboarding-actions">
                                <button className="wizard-secondary" onClick={() => goToStep(1)} disabled={isBusy}>
                                    Volver
                                </button>
                                <button className="wizard-secondary" onClick={handlePhotoSkip} disabled={isBusy}>
                                    Saltear
                                </button>
                                <button className="wizard-primary" onClick={handlePhotoUpload} disabled={isBusy}>
                                    {uploadingPhoto ? "Subiendo..." : "Subir foto"}
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="onboarding-step-content">
                            <h2>Datos básicos</h2>
                            <p>Completa la información esencial que aparecerá primero en tu perfil.</p>

                            <input
                                className="wizard-input"
                                type="text"
                                placeholder="Nombre completo"
                                value={basicData.nombre}
                                onChange={(event) =>
                                    setBasicData((previous) => ({ ...previous, nombre: event.target.value }))
                                }
                                disabled={isBusy}
                                maxLength={100}
                            />
                            <input
                                className="wizard-input"
                                type="text"
                                placeholder="Puesto actual"
                                value={basicData.puestoActual}
                                onChange={(event) =>
                                    setBasicData((previous) => ({ ...previous, puestoActual: event.target.value }))
                                }
                                disabled={isBusy}
                                maxLength={150}
                            />
                            <textarea
                                className="wizard-input wizard-textarea"
                                placeholder="Resumen profesional"
                                value={basicData.resumen}
                                onChange={(event) =>
                                    setBasicData((previous) => ({ ...previous, resumen: event.target.value }))
                                }
                                disabled={isBusy}
                                rows={5}
                            />

                            <div className="onboarding-actions">
                                <button className="wizard-secondary" onClick={() => goToStep(2)} disabled={isBusy}>
                                    Volver
                                </button>
                                <button className="wizard-primary" onClick={handleBasicDataNext} disabled={isBusy}>
                                    {savingStep ? "Guardando..." : "Siguiente"}
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="onboarding-step-content">
                            <h2>Cargar CV</h2>
                            <p>Sube tu archivo o pega el contenido para extraer y estructurar tu información profesional.</p>

                            <input
                                className="wizard-input"
                                type="file"
                                accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                                onChange={(event) => setCvFile(event.target.files?.[0] || null)}
                                disabled={isBusy}
                            />
                            <textarea
                                className="wizard-input wizard-textarea"
                                placeholder="O copia y pega aquí el contenido de tu CV"
                                value={cvText}
                                onChange={(event) => setCvText(event.target.value)}
                                disabled={isBusy}
                                rows={8}
                            />

                            <div className="onboarding-actions">
                                <button className="wizard-secondary" onClick={() => goToStep(3)} disabled={isBusy}>
                                    Volver
                                </button>
                                <button className="wizard-primary" onClick={handleProcessCv} disabled={isBusy}>
                                    {processingCv ? "Procesando..." : "Procesar CV"}
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 5 && (
                        <div className="onboarding-step-content">
                            <h2>Activar perfil público</h2>
                            <p>
                                Al activar tu perfil público, recruiters pueden descubrirte más rápido y conversar con tu avatar
                                profesional.
                            </p>

                            <label className="wizard-toggle-row">
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(event) => setIsPublic(event.target.checked)}
                                    disabled={isBusy}
                                />
                                <span>Hacer mi perfil público</span>
                            </label>

                            <div className="onboarding-actions">
                                <button className="wizard-secondary" onClick={() => goToStep(4)} disabled={isBusy}>
                                    Volver
                                </button>
                                <button className="wizard-secondary" onClick={() => handleComplete(false)} disabled={isBusy}>
                                    {completing ? "Guardando..." : "Guardar y Revisar Después"}
                                </button>
                                <button className="wizard-primary" onClick={() => handleComplete(true)} disabled={isBusy || !isPublic}>
                                    {completing ? "Completando..." : "Completar y Activar"}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
