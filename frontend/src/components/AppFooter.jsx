import React from "react";
import { useLocation } from "react-router-dom";
import "./AppFooter.css";

export default function AppFooter() {
  const location = useLocation();
  const hideFooter = location.pathname === "/chat" || location.pathname === "/perfil";

  if (hideFooter) {
    return null;
  }

  return (
    <footer className="app-footer" aria-label="Pie de página">
      <div className="app-footer-inner">
        <p>
          <strong>CV Conversacional</strong>
          <span> · Demo interactiva para presentar talento con más claridad.</span>
        </p>
      </div>
    </footer>
  );
}
