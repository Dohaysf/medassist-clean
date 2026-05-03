import React, { useState } from 'react';
import axios from 'axios';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import './PublicAboutPage.css';

const PublicAboutPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [formStatus, setFormStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormStatus('');
    try {
      await axios.post('http://localhost:5000/api/public/contact', formData);
      setFormStatus('✅ Message envoyé avec succès ! Nous vous répondrons rapidement.');
      setFormData({ name: '', email: '', message: '' });
    } catch (err) {
      console.error(err);
      setFormStatus('❌ Erreur lors de l\'envoi. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (index) => setOpenFaq(openFaq === index ? null : index);

  const faqItems = [
    { q: "Le service est-il vraiment gratuit ?", a: "Oui, l'assistant médical est accessible sans aucune inscription ni paiement." },
    { q: "Puis-je parler à un vrai médecin ?", a: "Notre assistant est un outil d'aide à la décision. En cas d'urgence, il vous orientera vers les services adaptés." },
    { q: "Mes données sont-elles sécurisées ?", a: "Absolument. Les conversations non rattachées sont anonymisées après 24h." },
    { q: "Comment rattacher une conversation ?", a: "Il suffit de créer un compte ou de vous connecter pendant la discussion." },
  ];

  return (
    <PublicLayout>
      <div className="about-page">
        {/* Hero */}
        <section className="about-hero">
          <div className="hero-content">
            <h1>À propos de MedAssist</h1>
            <p>Une plateforme médicale d'urgence accessible à tous, sans inscription.</p>
          </div>
        </section>

        {/* Stats */}
        <section className="stats-section">
          <div className="stat-card">
            <div className="stat-number">24/7</div>
            <div className="stat-label">Disponibilité</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">+10k</div>
            <div className="stat-label">Consultations</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">&lt;30s</div>
            <div className="stat-label">Première réponse</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">100%</div>
            <div className="stat-label">Gratuit</div>
          </div>
        </section>

        {/* Grid */}
        <div className="about-grid">
          <div className="about-text">
            <h2>Notre mission</h2>
            <p>
              MedAssist est né d’un constat simple : en situation d’urgence médicale, chaque seconde compte,
              et tout le monde n’a pas le temps ou la possibilité de créer un compte.
              Nous offrons donc un <strong>chat médical instantané et anonyme</strong>, avec des conseils fiables
              et une orientation vers les services adaptés.
            </p>
            <h2>Ce que nous proposons</h2>
            <ul className="feature-list">
              <li>💬 Chat intelligent basé sur des protocoles médicaux reconnus</li>
              <li>📍 Géolocalisation optionnelle pour une intervention rapide</li>
              <li>📋 Résumé pré-ESO (urgence) généré automatiquement</li>
              <li>🔒 Rattachement sécurisé des conversations à votre espace patient</li>
              <li>🚨 Alerte aux secours intégrée (en développement)</li>
            </ul>
          </div>

          <div className="about-faq">
            <h2>Foire aux questions</h2>
            {faqItems.map((item, idx) => (
              <div key={idx} className="faq-item">
                <button className="faq-question" onClick={() => toggleFaq(idx)}>
                  {item.q}
                  <span className="faq-icon">{openFaq === idx ? '−' : '+'}</span>
                </button>
                {openFaq === idx && <div className="faq-answer">{item.a}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="contact-section">
          <div className="contact-info">
            <h2>📞 Contactez-nous</h2>
            <p>Email : <a href="mailto:admin@gmail.com">admin@gmail.com</a></p>
            <p>Téléphone : <a href="tel:+212522123456">+212 5 22 123 456</a></p>
            <p>Adresse : Casablanca, Maroc</p>
          </div>
          <div className="contact-form">
            <h3>Envoyer un message</h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                name="name"
                placeholder="Votre nom"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <input
                type="email"
                name="email"
                placeholder="Votre email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <textarea
                name="message"
                rows="4"
                placeholder="Votre message..."
                value={formData.message}
                onChange={handleChange}
                required
              />
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Envoi en cours...' : 'Envoyer'}
              </button>
              {formStatus && <p className="form-status">{formStatus}</p>}
            </form>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default PublicAboutPage;