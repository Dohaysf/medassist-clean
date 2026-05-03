import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { FaComments, FaAmbulance, FaCalendarAlt, FaUserMd, FaHeartbeat, FaMapMarkerAlt, FaChartLine } from 'react-icons/fa';
import './StatisticsPage.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement);

const StatisticsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('http://localhost:5000/api/eso/sessions')
      .then(res => {
        setSessions(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="stats-page">Chargement des données...</div>;

  const total = sessions.length;
  const highUrgency = sessions.filter(s => {
    const sev = s.esoSummary?.severity;
    if (!sev) return false;
    const lower = sev.toLowerCase();
    return lower === 'critique' || lower === 'élevée';
  }).length;

  const avgAge = sessions.reduce((acc, s) => acc + (s.esoSummary?.age || 0), 0) / (total || 1);
  const avgIntensity = sessions.reduce((acc, s) => acc + (s.esoSummary?.intensity || 0), 0) / (total || 1);
  const uniqueDays = new Set(sessions.map(s => new Date(s.createdAt).toDateString())).size;

  const severityCount = { Critique: 0, Moyenne: 0, Faible: 0 };
  sessions.forEach(s => {
    let sev = s.esoSummary?.severity;
    if (!sev) return;
    const lower = sev.toLowerCase();
    if (lower === 'critique' || lower === 'élevée') severityCount.Critique++;
    else if (lower === 'moyenne') severityCount.Moyenne++;
    else if (lower === 'faible') severityCount.Faible++;
  });

  const severityData = {
    labels: ['Critique', 'Moyenne', 'Faible'],
    datasets: [{ data: Object.values(severityCount), backgroundColor: ['#7B61FF', '#2EC5C0', '#FFD166'], borderWidth: 0 }]
  };

  const dailyMap = {};
  sessions.forEach(s => {
    const date = new Date(s.createdAt).toLocaleDateString();
    dailyMap[date] = (dailyMap[date] || 0) + 1;
  });
  const dailyLabels = Object.keys(dailyMap).sort((a,b) => new Date(a) - new Date(b));
  const dailyDataValues = dailyLabels.map(d => dailyMap[d]);
  const evolutionData = {
    labels: dailyLabels,
    datasets: [{ label: 'Consultations', data: dailyDataValues, borderColor: '#2EC5C0', backgroundColor: 'rgba(46,197,192,0.1)', fill: true, tension: 0.3 }]
  };

  const symptomCount = {};
  sessions.forEach(s => {
    const sym = s.esoSummary?.symptom;
    if (sym) symptomCount[sym] = (symptomCount[sym] || 0) + 1;
  });
  const topSymptoms = Object.entries(symptomCount).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const symptomData = {
    labels: topSymptoms.map(item => item[0]),
    datasets: [{ label: 'Nombre de cas', data: topSymptoms.map(item => item[1]), backgroundColor: '#7B61FF', borderRadius: 8 }]
  };

  const bodyPartCount = {};
  sessions.forEach(s => {
    const bp = s.esoSummary?.bodyPart;
    if (bp) bodyPartCount[bp] = (bodyPartCount[bp] || 0) + 1;
  });
  const bodyPartData = {
    labels: Object.keys(bodyPartCount),
    datasets: [{ label: 'Nombre de cas', data: Object.values(bodyPartCount), backgroundColor: '#2EC5C0', borderRadius: 8 }]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Nombre' } } }
  };

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h1>📊 Tableau de bord médical</h1>
        <p>Analyse des consultations et indicateurs clés</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <FaComments className="kpi-icon" />
          <div className="kpi-info"><span className="kpi-value">{total}</span><span className="kpi-label">Consultations totales</span></div>
        </div>
        <div className="kpi-card">
          <FaAmbulance className="kpi-icon" />
          <div className="kpi-info"><span className="kpi-value">{highUrgency}</span><span className="kpi-label">Urgences critiques</span></div>
        </div>
        <div className="kpi-card">
          <FaUserMd className="kpi-icon" />
          <div className="kpi-info"><span className="kpi-value">{Math.round(avgAge)} ans</span><span className="kpi-label">Âge moyen</span></div>
        </div>
        <div className="kpi-card">
          <FaHeartbeat className="kpi-icon" />
          <div className="kpi-info"><span className="kpi-value">{avgIntensity.toFixed(1)}/10</span><span className="kpi-label">Intensité moyenne</span></div>
        </div>
        <div className="kpi-card">
          <FaCalendarAlt className="kpi-icon" />
          <div className="kpi-info"><span className="kpi-value">{uniqueDays}</span><span className="kpi-label">Jours d'activité</span></div>
        </div>
      </div>

      {/* Première ligne : évolution + camembert */}
      <div className="stats-grid">
        <div className="stats-card">
          <h3><FaChartLine /> Évolution des consultations</h3>
          <Line data={evolutionData} options={lineOptions} />
        </div>
        <div className="stats-card">
          <h3><FaHeartbeat /> Niveau d'urgence</h3>
          <Pie data={severityData} />
        </div>
      </div>

      {/* Deuxième ligne : symptômes + zones anatomiques */}
      <div className="stats-grid">
        <div className="stats-card">
          <h3><FaComments /> Symptômes les plus fréquents</h3>
          {topSymptoms.length ? <Bar data={symptomData} /> : <p>Aucune donnée</p>}
        </div>
        <div className="stats-card">
          <h3><FaMapMarkerAlt /> Zones anatomiques</h3>
          {Object.keys(bodyPartCount).length ? <Bar data={bodyPartData} /> : <p>Aucune donnée</p>}
        </div>
      </div>
    </div>
  );
};

export default StatisticsPage;