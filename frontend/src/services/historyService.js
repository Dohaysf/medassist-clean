import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const getSessions = async () => {
  try {
    const response = await axios.get(`${API_URL}/eso/sessions`);
    return response.data;
  } catch (error) {
    console.error('Erreur chargement sessions', error);
    return [];
  }
};