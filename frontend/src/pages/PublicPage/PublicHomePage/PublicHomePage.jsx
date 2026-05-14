import React from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import useTranslation from '../../../hooks/useTranslation';
import './PublicHomePage.css';

const PublicHomePage = () => {
  const navigate = useNavigate();

  const { t } = useTranslation();
  const T = t('home');

  return (
    <PublicLayout>
      <div className="home-page">

        {/* Hero section */}
        <section className="home-hero">
          <div className="hero-content">

            <div className="hero-badge">
              🏥 {T.badge}
            </div>

            <h1>{T.title}</h1>

            <p className="hero-subtitle">
              {T.subtitle}
            </p>

            <p className="hero-description">
              {T.heroDescription}
            </p>

            <div className="hero-buttons">
              <button
                className="hero-btn primary"
                onClick={() => navigate('/public/chat')}
              >
                {T.startConsultation}
              </button>

              <button
                className="hero-btn secondary"
                onClick={() => navigate('/public/about')}
              >
                {T.learnMore}
              </button>
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <span className="stat-value">24/7</span>
                <span className="stat-label">{T.available}</span>
              </div>

              <div className="hero-stat">
                <span className="stat-value">+10k</span>
                <span className="stat-label">{T.consultations}</span>
              </div>

              <div className="hero-stat">
                <span className="stat-value">&lt;30s</span>
                <span className="stat-label">{T.firstResponse}</span>
              </div>
            </div>
          </div>

          <div className="hero-illustration">
            <div className="floating-card card-1">
              <span>🩺</span>
              <span>{T.card1}</span>
            </div>

            <div className="floating-card card-2">
              <span>🤒</span>
              <span>{T.card2}</span>
            </div>

            <div className="floating-card card-3">
              <span>🚨</span>
              <span>{T.card3}</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="features-section">
          <div className="section-header">
            <span className="section-badge">
              {T.featuresBadge}
            </span>

            <h2>{T.featuresTitle}</h2>

            <p>{T.featuresDescription}</p>
          </div>

          <div className="features-grid">

            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>{T.feature1Title}</h3>
              <p>{T.feature1Desc}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📍</div>
              <h3>{T.feature2Title}</h3>
              <p>{T.feature2Desc}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <h3>{T.feature3Title}</h3>
              <p>{T.feature3Desc}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>{T.feature4Title}</h3>
              <p>{T.feature4Desc}</p>
            </div>

          </div>
        </section>

        {/* How it works */}
        <section className="howitworks-section">

          <div className="section-header">
            <span className="section-badge">
              {T.howBadge}
            </span>

            <h2>{T.howTitle}</h2>
          </div>

          <div className="steps-container">

            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-icon">💬</div>

              <h4>{T.step1Title}</h4>
              <p>{T.step1Desc}</p>
            </div>

            <div className="step-arrow">→</div>

            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-icon">🤖</div>

              <h4>{T.step2Title}</h4>
              <p>{T.step2Desc}</p>
            </div>

            <div className="step-arrow">→</div>

            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-icon">🩺</div>

              <h4>{T.step3Title}</h4>
              <p>{T.step3Desc}</p>
            </div>

          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <div className="cta-content">

            <h2>{T.ctaTitle}</h2>

            <p>{T.ctaDescription}</p>

            <button
              className="cta-btn"
              onClick={() => navigate('/public/chat')}
            >
              🚀 {T.ctaButton}
            </button>

          </div>
        </section>

      </div>
    </PublicLayout>
  );
};

export default PublicHomePage;