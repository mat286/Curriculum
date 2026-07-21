import React from "react";
import "./ScoreBar.css";

/** Barra de compatibilidad — nada de números pelados, una barra + % chico. */
export default function ScoreBar({ value }) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    return (
        <div className="ui-score-bar" title={`${pct}% de compatibilidad`}>
            <div className="ui-score-track">
                <div className="ui-score-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="ui-score-value">{pct}%</span>
        </div>
    );
}
