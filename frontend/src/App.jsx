import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import AppFooter from "./components/AppFooter";
import LoginPage from "./components/LoginPage";
import HomePage from "./pages/Home";
import ProfilePage from "./pages/ProfilePage";
import ChatPage from "./pages/Chat";
import CandidateChatPage from "./pages/CandidateChatPage";
import RecruiterPage from "./pages/RecruiterPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import "./index.css";

export default function App() {
    const { isAuthenticated, loading, user } = useAuth();

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
        <>
            <Navbar />
            <div className="main-container">
                <Routes>
                    <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
                    <Route path="/" element={<HomePage />} />
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
                    {/* Chat con candidato específico — debe ir ÚLTIMO para no capturar otras rutas */}
                    <Route
                        path="/:id"
                        element={
                            <ProtectedRoute>
                                <CandidateChatPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
            <AppFooter />
        </>
    );
}
