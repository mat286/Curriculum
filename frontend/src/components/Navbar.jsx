import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const handleLogoClick = () => {
        navigate("/");
    };

    const displayName = user?.nombre || user?.email?.split("@")[0] || "Tu perfil";

    return (
        <header className="navbar-shell">
            <nav className="navbar">
                <button type="button" className="navbar-logo" onClick={handleLogoClick}>
                    <span className="navbar-logo-mark">🧠</span>
                    <span>
                        <strong>CV Conversacional</strong>
                        <small>Hablar con talento, no solo leerlo</small>
                    </span>
                </button>

                <button
                    type="button"
                    className={`navbar-menu-toggle ${menuOpen ? "is-open" : ""}`}
                    aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((current) => !current)}
                >
                    <span />
                    <span />
                    <span />
                </button>

                <div className={`navbar-panel ${menuOpen ? "is-open" : ""}`}>
                    <ul className="navbar-links">
                        <li className={location.pathname === "/" ? "active" : ""}>
                            <Link to="/">Inicio</Link>
                        </li>
                        {isAuthenticated && (
                            <>
                                <li className={location.pathname === "/perfil" ? "active" : ""}>
                                    <Link to="/perfil">Mi perfil</Link>
                                </li>
                                <li className={location.pathname === "/search" ? "active" : ""}>
                                    <Link to="/search">Buscar candidatos</Link>
                                </li>
                                <li className={location.pathname === `/\${user?.id}` ? "active" : ""}>
                                    <Link to={`/${user?.id}`}>Hablar con mi IA</Link>
                                </li>
                            </>
                        )}
                    </ul>

                    <div className="navbar-actions">
                        {isAuthenticated ? (
                            <>
                                <div className="navbar-user">
                                    <span className="navbar-user-label">Sesión activa</span>
                                    <strong className="navbar-username">{displayName}</strong>
                                </div>
                                <Link to={`/${user?.id}`} className="nav-cta">
                                    Abrir demo
                                </Link>
                                <button onClick={handleLogout} className="navbar-logout" type="button">
                                    Cerrar sesión
                                </button>
                            </>
                        ) : (
                            <Link to="/login" className="nav-cta">
                                Ingresar con Google
                            </Link>
                        )}
                    </div>
                </div>
            </nav>
        </header>
    );
}
