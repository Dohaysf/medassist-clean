// backend/app/utils/esoBuilder.js
class ESOBuilder {
  constructor() {
    // Initialisation avec TOUS les champs nécessaires
    this.data = {
      symptom: null,
      bodyPart: null,
      duration: null,
      intensity: null,
      age: null,
      patientLocation: null,
      severity: 'inconnue',
      location: null
    };
  }

  // Méthode pour réinitialiser complètement le builder
  reset() {
    this.data = {
      symptom: null,
      bodyPart: null,
      duration: null,
      intensity: null,
      age: null,
      patientLocation: null,
      severity: 'inconnue',
      location: null
    };
    console.log('🔄 ESOBuilder réinitialisé');
    return this.data;
  }

  update(newInfo) {
    if (!newInfo) return this.data;
    
    console.log('📦 [ESOBuilder] update reçoit:', JSON.stringify(newInfo));
    
    // Ne mettre à jour que les champs qui sont vraiment fournis
    Object.keys(newInfo).forEach(key => {
      const value = newInfo[key];
      // Ignorer les valeurs null/undefined/vides
      if (value !== null && value !== undefined && value !== '') {
        // ✅ TRAITEMENT SPÉCIAL POUR L'ÂGE
        if (key === 'age') {
          const age = Number(value);
          if (!isNaN(age) && age >= 0 && age <= 120) {
            this.data[key] = age;
            console.log(`✅ Âge mis à jour: ${age}`);
          } else {
            console.warn(`❌ Âge invalide rejeté: ${value}`);
          }
        } else {
          this.data[key] = value;
        }
      }
    });
    
    // Recalculer la sévérité
    this.data.severity = this.calculateSeverity();
    console.log('📋 [ESOBuilder] Après update:', JSON.stringify(this.data));
    
    return this.data;
  }

  calculateSeverity() {
    const s = this.data;
    const intensity = parseInt(s.intensity);
    const duration = s.duration ? parseInt(s.duration) : 0;

    // Règles critiques
    if (s.symptom === 'douleur' && s.bodyPart === 'poitrine') return 'critique';
    if (s.symptom === 'dyspnee') return 'critique';
    if (s.symptom === 'saignement') return 'critique';
    if (s.symptom === 'perte_connaissance') return 'critique';
    if (s.symptom === 'traumatisme') return 'critique';
    if (s.symptom === 'brulure') return 'critique';
    if (intensity >= 8) return 'critique';
    if (intensity >= 5 && duration > 24) return 'critique';
    if (intensity >= 5) return 'élevée';
    if (intensity >= 3) return 'moyenne';
    if (s.symptom) return 'faible';
    return 'inconnue';
  }

  getSummary() {
    return { ...this.data };
  }

  // Vérifier si un champ est présent
  has(field) {
    return !!this.data[field];
  }

  // Ajout de localisation structurée
  addLocation(location) {
    if (!location) return;
    this.data.location = {
      city: location.city || null,
      region: location.region || null,
      country: location.country || null,
      formatted: location.formatted || null,
      latitude: location.latitude || null,
      longitude: location.longitude || null,
      detectedAt: new Date().toISOString()
    };
    this.data.patientLocation = location.formatted || location.city || 'Position inconnue';
  }

  // Validation avant envoi PFA
  isValidForPFA() {
    const required = ['symptom', 'bodyPart', 'duration', 'age', 'patientLocation'];
    for (const field of required) {
      if (!this.data[field]) return false;
    }
    const age = Number(this.data.age);
    if (isNaN(age) || age < 0 || age > 120) return false;
    if (this.data.intensity !== undefined && this.data.intensity !== null) {
      const intensity = Number(this.data.intensity);
      if (isNaN(intensity) || intensity < 1 || intensity > 10) return false;
    }
    return true;
  }
}

module.exports = ESOBuilder;