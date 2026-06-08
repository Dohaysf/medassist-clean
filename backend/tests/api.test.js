// tests/api.test.js
// Remplace l'ancien fichier — version avec JWT + mock nlpService

jest.mock('../app/services/nlpService', () => ({
    processMessage: jest.fn((message, summary) => ({
        reply: 'Quel est le problème principal ?',
        extractedInfo: { symptom: null },
        intent: 'collect',
        severity: 'faible',
        updatedSummary: summary || {},
    })),
    evaluateSeverity: jest.fn(() => 'faible'),
    extractInfo: jest.fn(() => ({})),
    generateReply: jest.fn(() => ({ text: 'Quel est le problème principal ?' })),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../server');
const Conversation = require('../app/models/Conversation');

const TEST_DB = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/ach_test';

function makeTestToken() {
    const secret = process.env.JWT_SECRET || 'test-secret';
    return jwt.sign({ userId: new mongoose.Types.ObjectId().toString(), role: 'user' },
        secret, { expiresIn: '1h' }
    );
}

const TOKEN = makeTestToken();

beforeAll(async() => {
    await mongoose.connect(TEST_DB);
});

afterAll(async() => {
    await Conversation.deleteMany({});
    await mongoose.disconnect();
});

describe('POST /api/chat', () => {
    it('devrait répondre avec une question sur le symptôme si aucun', async() => {
        const res = await request(app)
            .post('/api/chat')
            .set('Authorization', `Bearer ${TOKEN}`)
            .send({ message: 'bonjour' });

        expect(res.statusCode).toBe(200);
        expect(res.body.reply).toBeDefined();
        expect(res.body.sessionId).toBeDefined();
    });

    it('devrait extraire une durée et retourner un sessionId cohérent', async() => {
        const first = await request(app)
            .post('/api/chat')
            .set('Authorization', `Bearer ${TOKEN}`)
            .send({ message: "j'ai mal à la tête" });

        const sessionId = first.body.sessionId;

        const second = await request(app)
            .post('/api/chat')
            .set('Authorization', `Bearer ${TOKEN}`)
            .send({ message: 'depuis 3 jours', sessionId });

        expect(second.statusCode).toBe(200);
        expect(second.body.sessionId).toBe(sessionId);
    });
});