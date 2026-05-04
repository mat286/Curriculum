import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import AppFooter from "./components/AppFooter";
import LoginPage from "./components/LoginPage";
import HomePage from "./pages/Home";
import ProfilePage from "./pages/ProfilePage";
import CandidateChatPage from "./pages/CandidateChatPage";
import RecruiterPage from "./pages/RecruiterPage";
import NotFoundPage from "./pages/NotFoundPage";
import OnboardingPage from "./pages/OnboardingPage";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import "./index.css";
import AdminPage from "./pages/AdminPage";

export default function App() {
    const { isAuthenticated, loading, user, onboardingCompleted } = useAuth();

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-card">
                    <span className="app-eyebrow">Preparando experiencia</span>
                    <div className="loading">Cargando tu CV conversacional...</div>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <Navbar />
            <div className="main-container">
                <Routes>
                    <Route
                        path="/login"
                        element={
                            isAuthenticated ? (
                                <Navigate to={onboardingCompleted ? "/" : "/onboarding"} replace />
                            ) : (
                                <LoginPage />
                            )
                        }
                    />
                    <Route path="/" element={<HomePage />} />
                    <Route
                        path="/onboarding"
                        element={
                            <ProtectedRoute>
                                <OnboardingPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/perfil"
                        element={
                            <ProtectedRoute>
                                <ProfilePage />
                            </ProtectedRoute>
                        }
                    />
                    {/* /chat redirige al perfil del usuario autenticado */}
                    <Route
                        path="/chat"
                        element={
                            <ProtectedRoute>
                                <Navigate to={`/${user?.id}`} replace />
                            </ProtectedRoute>
                        }
                    />
                    {/* Búsqueda inteligente de candidatos para recruiters */}
                    <Route
                        path="/search"
                        element={
                            <ProtectedRoute>
                                <RecruiterPage />
                            </ProtectedRoute>
                        }
                    />
                       {/* Admin Telemetry Dashboard */}
                       <Route
                           path="/admin/telemetry"
                           element={
                               <ProtectedRoute>
                                   <AdminPage />
                               </ProtectedRoute>
                           }
                       />
                    {/* Chat con candidato específico — debe ir ÚLTIMO para no capturar otras rutas */}
                    <Route
                        path="/:id"
                        element={
                            <ProtectedRoute>
                                <CandidateChatPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </div>
            <AppFooter />
        </ErrorBoundary>
    );
}
