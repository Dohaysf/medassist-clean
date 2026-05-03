import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './PatientESO.css';

const PatientESO = () => {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('http://localhost:5000/api/patient/eso', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setResumes(res.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="patient-eso">
      <h1>Mes résumés ESO</h1>
      {resumes.length === 0 && <p>Aucun résumé pour le moment.</p>}
      <div className="eso-list">
        {resumes.map((item, idx) => (
          <div key={idx} className="eso-card">
            <div className="eso-date">{new Date(item.createdAt).toLocaleString()}</div>
            <pre>{JSON.stringify(item.esoSummary, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatientESO;