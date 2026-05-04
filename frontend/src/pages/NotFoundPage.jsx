import React from "react";
import { Link } from "react-router-dom";
import "./NotFoundPage.css";

export default function NotFoundPage() {
    return (
        <div className="notfound-container">
            <div className="notfound-card">
                <span className="notfound-code">404</span>
                <h1 className="notfound-title">Página no encontrada</h1>
                <p className="notfound-desc">
                    La dirección que buscás no existe o fue movida.
                </p>
                <Link to="/" className="notfound-btn">
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
}
