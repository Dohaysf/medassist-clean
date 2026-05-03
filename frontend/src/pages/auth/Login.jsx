import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) return setError('Email invalide');
    if (password.length < 6) return setError('Mot de passe trop court');
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userRole', res.data.user.role);

      const sessionId = localStorage.getItem('currentSessionId');
      if (sessionId && res.data.user.role === 'patient') {
        try {
          await axios.post('http://localhost:5000/api/patient/attach-conversation', { sessionId }, {
            headers: { Authorization: `Bearer ${res.data.token}` }
          });
          console.log('Conversation rattachée');
          localStorage.removeItem('currentSessionId');
        } catch (err) {
          console.error('Erreur rattachement', err);
        }
      }

      if (res.data.user.role === 'manager') navigate('/manager/dashboard');
      else navigate('/patient/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <h2>Connexion</h2>
        <p className="subtitle">Accédez à votre espace médical</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
        </form>
        <p className="link">Pas de compte ? <a href="/register">S'inscrire</a></p>
      </div>
    </div>
  );
};

export default Login;