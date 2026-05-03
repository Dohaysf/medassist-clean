// frontend/src/pages/PatientPage/PatientInfo/PatientInfo.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './PatientInfo.css';

const PatientInfo = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setUser(res.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="patient-info-loading">Chargement...</div>;

  return (
    <div className="patient-info">
      <h1>Mes informations personnelles</h1>
      <div className="info-card">
        <div className="info-row"><strong>Nom complet :</strong> {user.name}</div>
        <div className="info-row"><strong>Email :</strong> {user.email}</div>
        <div className="info-row"><strong>Âge :</strong> {user.age || 'Non renseigné'}</div>
        <div className="info-row"><strong>Sexe :</strong> {user.gender === 'homme' ? 'Homme' : user.gender === 'femme' ? 'Femme' : 'Non renseigné'}</div>
        <div className="info-row"><strong>Téléphone :</strong> {user.phone || 'Non renseigné'}</div>
        <div className="info-row"><strong>Rôle :</strong> {user.role === 'patient' ? 'Patient' : 'Manager'}</div>
        <div className="info-row"><strong>Date d'inscription :</strong> {new Date(user.createdAt).toLocaleDateString()}</div>

        {user.medicalHistory && (
          <div className="medical-history">
            <h3>Antécédents médicaux</h3>
            <ul>
              {user.medicalHistory.diabete && <li>Diabète</li>}
              {user.medicalHistory.asthme && <li>Asthme</li>}
              {user.medicalHistory.tension && <li>Hypertension</li>}
              {user.medicalHistory.other && <li>Autre : {user.medicalHistory.other}</li>}
              {!user.medicalHistory.diabete && !user.medicalHistory.asthme && !user.medicalHistory.tension && !user.medicalHistory.other && <li>Aucun antécédent déclaré</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientInfo;