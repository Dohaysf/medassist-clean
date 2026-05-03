import React from "react";
import "./ESOSummary.css";
import {
  FaUser,
  FaMapMarkerAlt,
  FaClock,
  FaTachometerAlt,
  FaBirthdayCake,
  FaMapPin,
  FaExclamationTriangle,
} from "react-icons/fa";

const ESOSummary = ({ summary }) => {
  const normalized = {
    symptom: summary.symptom,
    bodyPart: summary.bodyPart,
    duration: summary.duration,
    intensity: summary.intensity,
    age: summary.age,
    patientLocation: summary.patientLocation,
    severity: summary.severity,
  };

  const formatSeverity = (severity) => {
    if (!severity) return null;
    const sevMap = {
      élevée: { label: "Critique", color: "#E53E3E", icon: <FaExclamationTriangle /> },
      moyenne: { label: "Moyenne", color: "#ED8936", icon: <FaExclamationTriangle /> },
      faible: { label: "Faible", color: "#38A169", icon: <FaExclamationTriangle /> },
    };
    const key = severity.toLowerCase();
    return sevMap[key] || { label: severity, color: "#718096", icon: null };
  };

  const severityData = formatSeverity(normalized.severity);

  const fields = [
    { key: "symptom", label: "Symptôme", icon: <FaUser /> },
    { key: "bodyPart", label: "Partie du corps", icon: <FaMapMarkerAlt /> },
    { key: "duration", label: "Durée", icon: <FaClock /> },
    { key: "intensity", label: "Intensité (/10)", icon: <FaTachometerAlt /> },
    { key: "age", label: "Âge", icon: <FaBirthdayCake /> },
    { key: "patientLocation", label: "Localisation", icon: <FaMapPin /> },
  ];

  const hasData = Object.values(normalized).some(
    (v) => v !== undefined && v !== null && v !== ""
  );

  return (
    <div className="eso-card">
      <div className="eso-header">
        <h3>📋 Résumé pré-ESO</h3>
        <span className={`status-badge ${!hasData ? "waiting" : "in-progress"}`}>
          {!hasData ? "En attente" : "En cours"}
        </span>
      </div>
      <div className="eso-body">
        {!hasData ? (
          <p className="empty-state">
            Aucune information pour l'instant.
            <br />
            Commencez la conversation avec l'assistant.
          </p>
        ) : (
          <>
            {severityData && (
              <div className="severity-pill" style={{ backgroundColor: severityData.color }}>
                {severityData.icon && <span className="severity-icon">{severityData.icon}</span>}
                <span>Urgence {severityData.label}</span>
              </div>
            )}
            <ul className="eso-list">
              {fields.map(({ key, label, icon }) => {
                let value = normalized[key];
                if (!value) return null;
                if (key === 'intensity' && !isNaN(value)) value = `${value}/10`;
                return (
                  <li key={key} className="eso-item">
                    <span className="eso-key">
                      {icon && <span className="eso-icon">{icon}</span>}
                      {label}
                    </span>
                    <span className="eso-value">{value}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default ESOSummary;