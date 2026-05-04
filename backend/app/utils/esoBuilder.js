class ESOBuilder {
  constructor() {
    this.data = {
      symptom: null,
      bodyPart: null,
      duration: null,
      intensity: null,
      age: null,
      patientLocation: null,
      severity: 'inconnue'
    };
  }

  reset() {
    this.data = {
      symptom: null,
      bodyPart: null,
      duration: null,
      intensity: null,
      age: null,
      patientLocation: null,
      severity: 'inconnue'
    };
    console.log('🔄 ESOBuilder réinitialisé');
    return this.data;
  }

  update(newInfo) {
    if (!newInfo) return this.data;
    
    console.log('📦 [ESOBuilder] update reçoit:', JSON.stringify(newInfo));
    
    Object.keys(newInfo).forEach(key => {
      const value = newInfo[key];
      if (value !== null && value !== undefined && value !== '') {
        // Traitement spécial pour l'âge
        if (key === 'age') {
          const age = Number(value);
          if (!isNaN(age) && age >= 0 && age <= 120) {
            this.data[key] = age;
            console.log(`✅ Âge: ${age}`);
          }
        } 
        // Traitement pour bodyPart (normalisation)
        else if (key === 'bodyPart') {
          let normalized = value.toLowerCase();
          if (normalized === 'tête') normalized = 'tete';
          if (normalized === 'ventre') normalized = 'abdomen';
          this.data[key] = normalized;
          console.log(`✅ BodyPart: ${normalized}`);
        }
        else {
          this.data[key] = value;
          console.log(`✅ ${key}: ${value}`);
        }
      }
    });
    
    this.data.severity = this.calculateSeverity();
    console.log('📋 [ESOBuilder] Résultat:', JSON.stringify(this.data));
    
    return this.data;
  }

  calculateSeverity() {
    const s = this.data;
    const intensity = parseInt(s.intensity);
    
    // Critiques
    if (s.symptom === 'douleur' && s.bodyPart === 'poitrine') return 'critique';
    if (s.symptom === 'dyspnee') return 'critique';
    if (s.symptom === 'saignement') return 'critique';
    if (s.symptom === 'perte_connaissance') return 'critique';
    if (intensity >= 8) return 'critique';
    if (intensity >= 5) return 'élevée';
    if (intensity >= 3) return 'moyenne';
    if (s.symptom) return 'faible';
    return 'inconnue';
  }

  getSummary() {
    return { ...this.data };
  }

  has(field) {
    return !!this.data[field];
  }

  isValidForPFA() {
    const required = ['symptom', 'bodyPart', 'duration', 'age', 'patientLocation'];
    for (const field of required) {
      if (!this.data[field]) return false;
    }
    const age = Number(this.data.age);
    if (isNaN(age) || age < 0 || age > 120) return false;
    return true;
  }
}

module.exports = ESOBuilder;