// tests/setup.js
process.env.USE_GROQ = 'false';
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'test-key';
process.env.D7_API_KEY = 'test-d7-key';
process.env.EMERGENCY_PHONE = '+212600000000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';