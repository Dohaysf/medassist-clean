import React from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import './PublicHomePage.css';

const PublicHomePage = () => {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="home-page">
        {/* Hero section */}
        <section className="home-hero">
          <div className="hero-content">
            <div className="hero-badge">🏥 Consultation médicale 24/7</div>
            <h1>MedAssist</h1>
            <p className="hero-subtitle">Assistant médical pré-hospitalier</p>
            <p className="hero-description">
              Décrivez vos symptômes, notre IA vous guide et vous oriente vers les bons gestes.
              Gratuit, anonyme et sans inscription.
            </p>
            <div className="hero-buttons">
              <button className="hero-btn primary" onClick={() => navigate('/public/chat')}>
                ✨ Commencer une consultation
              </button>
              <button className="hero-btn secondary" onClick={() => navigate('/public/about')}>
                En savoir plus
              </button>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="stat-value">24/7</span>
                <span className="stat-label">Disponible</span>
              </div>
              <div className="hero-stat">
                <span className="stat-value">+10k</span>
                <span className="stat-label">Consultations</span>
              </div>
              <div className="hero-stat">
                <span className="stat-value">&lt;30s</span>
                <span className="stat-label">Première réponse</span>
              </div>
            </div>
          </div>
          <div className="hero-illustration">
            <div className="floating-card card-1">
              <span>🩺</span>
              <span>Douleur thoracique ?</span>
            </div>
            <div className="floating-card card-2">
              <span>🤒</span>
              <span>Fièvre depuis 3 jours</span>
            </div>
            <div className="floating-card card-3">
              <span>🚨</span>
              <span>Urgence détectée</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="features-section">
          <div className="section-header">
            <span className="section-badge">Pourquoi MedAssist ?</span>
            <h2>Une assistance médicale immédiate</h2>
            <p>Des réponses rapides basées sur des protocoles médicaux reconnus</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Chat intelligent</h3>
              <p>Analyse vos symptômes et vous guide vers les bons gestes de premiers secours.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📍</div>
              <h3>Géolocalisation</h3>
              <p>Partagez votre position pour une intervention rapide des secours.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <h3>Résumé médical</h3>
              <p>Génération automatique d'un résumé pré-ESO pour les urgentistes.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>100% gratuit</h3>
              <p>Sans inscription, anonyme et sécurisé. Vos données sont protégées.</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="howitworks-section">
          <div className="section-header">
            <span className="section-badge">Comment ça marche ?</span>
            <h2>3 étapes simples</h2>
          </div>
          <div className="steps-container">
            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-icon">💬</div>
              <h4>Décrivez vos symptômes</h4>
              <p>Expliquez simplement ce que vous ressentez</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-icon">🤖</div>
              <h4>Analyse IA</h4>
              <p>Notre assistant analyse votre situation</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-icon">🩺</div>
              <h4>Conseils adaptés</h4>
              <p>Recevez des recommandations médicales</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <div className="cta-content">
            <h2>Prêt à consulter ?</h2>
            <p>Décrivez vos symptômes et obtenez une réponse immédiate, 24h/24 et 7j/7.</p>
            <button className="cta-btn" onClick={() => navigate('/public/chat')}>
              🚀 Commencer maintenant
            </button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
};

export default PublicHomePage;