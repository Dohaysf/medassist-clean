const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Le nom est requis'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'L\'email est requis'],
        lowercase: true,
        trim: true,
        match: [/.+\@.+\..+/, 'Email invalide']
    },
    message: {
        type: String,
        required: [true, 'Le message est requis'],
        trim: true
    },
    read: {
        type: Boolean,
        default: false // ← nouveau champ
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Contact', contactSchema);