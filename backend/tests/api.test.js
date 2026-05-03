const request = require('supertest');
const app = require('../server'); // assurez-vous que server.js exporte app
const mongoose = require('mongoose');
const Conversation = require('../app/models/Conversation');

// Utilisez une base de test (vous pouvez définir MONGO_URI_TEST dans .env.test)
const testDB = 'mongodb://localhost:27017/medical_chatbot_test';

beforeAll(async () => {
  await mongoose.connect(testDB);
});

afterAll(async () => {
  await Conversation.deleteMany({});
  await mongoose.disconnect();
});

describe('POST /api/chat', () => {
  it('devrait répondre avec une question sur le symptôme si aucun', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'bonjour' });
    expect(res.statusCode).toBe(200);
    expect(res.body.reply).toContain('Quel est le problème principal');
    expect(res.body.sessionId).toBeDefined();
  });

  it('devrait extraire une durée et répondre avec la question suivante', async () => {
    // Démarrer une session
    const first = await request(app)
      .post('/api/chat')
      .send({ message: 'j ai mal à la tête' });
    const sessionId = first.body.sessionId;

    const second = await request(app)
      .post('/api/chat')
      .send({ message: 'depuis 3 jours', sessionId });
    expect(second.statusCode).toBe(200);
    expect(second.body.reply).toContain('intensité');
    expect(second.body.esoSummary.duration).toBe('3 jours');
  });
});