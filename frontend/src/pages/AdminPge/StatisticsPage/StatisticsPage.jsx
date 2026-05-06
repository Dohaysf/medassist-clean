import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { FaComments, FaAmbulance, FaCalendarAlt, FaUserMd, FaHeartbeat, FaMapMarkerAlt, FaChartLine, FaSync } from 'react-icons/fa';
import './StatisticsPage.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement);

const StatisticsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/eso/sessions');
      setSessions(res.data);
    } catch (err) {
      console.error('Erreur chargement:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  if (loading) {
    return (
      <div className="stats-page">
        <div className="loading-container">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <p>Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

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

  // Données sévérité
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
    datasets: [{
      data: Object.values(severityCount),
      backgroundColor: ['#d9534f', '#f0ad4e', '#5cb85c'],
      borderWidth: 0,
      borderRadius: 8
    }]
  };

  // Évolution quotidienne
  const dailyMap = {};
  sessions.forEach(s => {
    const date = new Date(s.createdAt).toLocaleDateString('fr-FR');
    dailyMap[date] = (dailyMap[date] || 0) + 1;
  });
  const dailyLabels = Object.keys(dailyMap).sort((a, b) => new Date(a) - new Date(b));
  const dailyDataValues = dailyLabels.map(d => dailyMap[d]);
  
  const evolutionData = {
    labels: dailyLabels,
    datasets: [{
      label: 'Consultations',
      data: dailyDataValues,
      borderColor: '#c96a3a',
      backgroundColor: 'rgba(201, 106, 58, 0.05)',
      fill: true,
      tension: 0.3,
      pointBackgroundColor: '#c96a3a',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  };

  // Symptômes fréquents
  const symptomCount = {};
  sessions.forEach(s => {
    const sym = s.esoSummary?.symptom;
    if (sym) symptomCount[sym] = (symptomCount[sym] || 0) + 1;
  });
  const topSymptoms = Object.entries(symptomCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  
  const symptomData = {
    labels: topSymptoms.map(item => item[0]),
    datasets: [{
      label: 'Nombre de cas',
      data: topSymptoms.map(item => item[1]),
      backgroundColor: '#c96a3a',
      borderRadius: 8,
      barPercentage: 0.7
    }]
  };

  // Zones anatomiques
  const bodyPartCount = {};
  sessions.forEach(s => {
    const bp = s.esoSummary?.bodyPart;
    if (bp) bodyPartCount[bp] = (bodyPartCount[bp] || 0) + 1;
  });
  
  const bodyPartData = {
    labels: Object.keys(bodyPartCount),
    datasets: [{
      label: 'Nombre de cas',
      data: Object.values(bodyPartCount),
      backgroundColor: '#2EC5C0',
      borderRadius: 8,
      barPercentage: 0.7
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { size: 11 } }
      },
      tooltip: { backgroundColor: '#1a1915', titleColor: '#fff', bodyColor: '#ccc' }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { color: 'rgba(0,0,0,0.05)' },
        title: { display: true, text: 'Nombre', font: { size: 11 } }
      },
      x: { grid: { display: false } }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 11 } } }
    }
  };

  if (total === 0) {
    return (
      <div className="stats-page">
        <div className="stats-header">
          <h1>📊 Tableau de bord médical</h1>
          <p>Analyse des consultations et indicateurs clés</p>
        </div>
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>Aucune donnée</h3>
          <p>Les statistiques apparaîtront ici après les premières consultations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-page">
      <div className="stats-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1>📊 Tableau de bord médical</h1>
            <p>Analyse des consultations et indicateurs clés</p>
          </div>
          <button 
            onClick={handleRefresh} 
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 20px',
              background: '#f0ede6',
              border: '1px solid #e3e1db',
              borderRadius: '24px',
              fontSize: '0.85rem',
              color: '#6b6963',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <FaSync style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <FaComments className="kpi-icon" />
          <div className="kpi-info">
            <span className="kpi-value">{total}</span>
            <span className="kpi-label">Consultations totales</span>
          </div>
        </div>
        <div className="kpi-card">
          <FaAmbulance className="kpi-icon" />
          <div className="kpi-info">
            <span className="kpi-value">{highUrgency}</span>
            <span className="kpi-label">Urgences critiques</span>
          </div>
        </div>
        <div className="kpi-card">
          <FaUserMd className="kpi-icon" />
          <div className="kpi-info">
            <span className="kpi-value">{Math.round(avgAge)} ans</span>
            <span className="kpi-label">Âge moyen</span>
          </div>
        </div>
        <div className="kpi-card">
          <FaHeartbeat className="kpi-icon" />
          <div className="kpi-info">
            <span className="kpi-value">{avgIntensity.toFixed(1)}/10</span>
            <span className="kpi-label">Intensité moyenne</span>
          </div>
        </div>
        <div className="kpi-card">
          <FaCalendarAlt className="kpi-icon" />
          <div className="kpi-info">
            <span className="kpi-value">{uniqueDays}</span>
            <span className="kpi-label">Jours d'activité</span>
          </div>
        </div>
      </div>

      {/* Graphiques ligne 1 */}
      <div className="stats-grid">
        <div className="stats-card">
          <h3><FaChartLine /> Évolution des consultations</h3>
          <div className="chart-container">
            <Line data={evolutionData} options={chartOptions} />
          </div>
        </div>
        <div className="stats-card">
          <h3><FaHeartbeat /> Niveau d'urgence</h3>
          <div className="chart-container">
            <Pie data={severityData} options={pieOptions} />
          </div>
        </div>
      </div>

      {/* Graphiques ligne 2 */}
      <div className="stats-grid">
        <div className="stats-card">
          <h3><FaComments /> Symptômes les plus fréquents</h3>
          <div className="chart-container">
            {topSymptoms.length > 0 ? (
              <Bar data={symptomData} options={chartOptions} />
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Aucune donnée</p>
            )}
          </div>
        </div>
        <div className="stats-card">
          <h3><FaMapMarkerAlt /> Zones anatomiques</h3>
          <div className="chart-container">
            {Object.keys(bodyPartCount).length > 0 ? (
              <Bar data={bodyPartData} options={chartOptions} />
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Aucune donnée</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPage;