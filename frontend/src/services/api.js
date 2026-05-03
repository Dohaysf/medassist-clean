import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const sendMessage = async (message, sessionId) => {
  try {
    const response = await api.post('/chat', { message, sessionId });
    return response.data;
  } catch (error) {
    console.error('Erreur API', error);
    return { reply: "Désolé, l'assistant est indisponible." };
  }
};

// UNE SEULE fonction, qui utilise api (l'intercepteur ajoute le token)
export const attachConversation = async (sessionId) => {
  try {
    const response = await api.post('/patient/attach-conversation', { sessionId });
    return response.data;
  } catch (error) {
    console.error('Erreur rattachement', error);
    throw error;
  }
};