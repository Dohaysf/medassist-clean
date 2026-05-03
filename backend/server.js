const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./app/config/db');
const chatRoutes = require('./app/routes/chat');
const esoRoutes = require('./app/routes/eso');
const authRoutes = require('./app/routes/auth.routes');
const patientRoutes = require('./app/routes/patient.routes');
const publicRoutes = require('./app/routes/public.routes');
const adminRoutes = require('./app/routes/admin.routes');

// IMPORT DU SERVICE RAG
const ragService = require('./app/services/ragService');

console.log('📌 Vérification des variables d\'environnement :');
console.log('📌 GROQ_API_KEY présente ?', process.env.GROQ_API_KEY ? 'Oui' : 'Non');
console.log('📌 USE_GROQ =', process.env.USE_GROQ);
console.log('📌 PORT =', process.env.PORT);
console.log('📌 MONGO_URI =', process.env.MONGO_URI ? 'Définie' : 'Non définie');
console.log('📌 D7_API_KEY présente ?', process.env.D7_API_KEY ? 'Oui' : 'Non');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/eso', esoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'MedAssist API', status: 'running' });
});

// DÉMARRAGE
if (require.main === module) {
    console.log('🔧 Connexion à MongoDB...');
    connectDB()
        .then(async () => {
            console.log('✅ MongoDB connecté');
            
            // Initialisation ChromaDB (avec axios)
            console.log('🔧 Initialisation du RAG vectoriel...');
            const chromaReady = await ragService.initChromaDB();
            
            if (chromaReady) {
                console.log('✅ RAG vectoriel prêt à l\'emploi');
            } else {
                console.log('⚠️ RAG vectoriel non disponible, le chatbot utilisera Groq uniquement');
            }
            
            // DÉMARRAGE DU SERVEUR
            app.listen(port, () => {
                console.log(`🚀 Serveur backend démarré sur http://localhost:${port}`);
                console.log(`📡 API disponible: http://localhost:${port}/api/chat`);
            });
        })
        .catch(err => {
            console.error('❌ Erreur de connexion MongoDB:', err);
            process.exit(1);
        });
}

module.exports = app;