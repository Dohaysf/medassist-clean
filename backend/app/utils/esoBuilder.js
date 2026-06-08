// backend/app/utils/esoBuilder.js

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
            // Ne jamais écraser une valeur existante par null/vide
            const value = newInfo[key];
            if (value === null || value === undefined || value === '') return;
            // Ignorer les clés internes
            if (key.startsWith('_')) return;

            if (key === 'age') {
                const age = Number(value);
                if (!isNaN(age) && age >= 0 && age <= 120) {
                    this.data.age = age;
                    console.log(`✅ Âge: ${age}`);
                }
            } else if (key === 'severity') {
                // La severity vient de processMessageGroq ou nlpService — ne pas l'écraser ici
                // Elle sera assignée en fin de update() via calculateSeverity() seulement
                // si aucune severity externe n'est fournie explicitement
                this._externalSeverity = value;
            } else {
                this.data[key] = value;
                console.log(`✅ ${key}: ${value}`);
            }
        });

        // Priorité : severity externe (de processMessageGroq) > calculateSeverity()
        if (this._externalSeverity &&
            this._externalSeverity !== 'faible' &&
            this._externalSeverity !== 'inconnue') {
            this.data.severity = this._externalSeverity;
            console.log(`✅ Severity externe conservée: ${this.data.severity}`);
        } else {
            this.data.severity = this.calculateSeverity();
        }

        console.log('📋 [ESOBuilder] Résultat:', JSON.stringify(this.data));
        return this.data;
    }

    calculateSeverity() {
        const s = this.data;

        // Intensité numérique
        const intensityNum = typeof s.intensity === 'number' ?
            s.intensity :
            parseInt(String(s.intensity || '0'), 10);

        // Intensité textuelle
        const intensityStr = String(s.intensity || '').toLowerCase();
        const isVeryHigh =
            intensityNum >= 8 ||
            intensityStr.includes('insupportable') ||
            intensityStr.includes('atroce') ||
            intensityStr.includes('très fort') ||
            intensityStr.includes('très forte');

        const bodyPart = (s.bodyPart || '').toLowerCase();
        const symptom = (s.symptom || '').toLowerCase();

        // ── CRITIQUE ──────────────────────────────────────────────────────────────

        // Douleur poitrine/thorax + irradiation bras/épaule/mâchoire → infarctus
        const isChestPain =
            bodyPart.includes('poitrine') || bodyPart.includes('thorax') ||
            symptom.includes('poitrine') || symptom.includes('cardiaque') ||
            symptom.includes('infarctus');

        const hasRadiation =
            bodyPart.includes('bras') || bodyPart.includes('épaule') ||
            bodyPart.includes('gauche') || bodyPart.includes('machoire') ||
            bodyPart.includes('mâchoire');

        if (isChestPain && hasRadiation) {
            console.log('🔴 [ESOBuilder] CRITIQUE — Signes d\'infarctus');
            return 'critique';
        }

        // Inconscience / AVC
        if (
            symptom.includes('inconscien') || symptom.includes('perte de connaissance') ||
            symptom.includes('coma') || symptom.includes('avc') || symptom.includes('paralysie')
        ) {
            console.log('🔴 [ESOBuilder] CRITIQUE — Inconscience/AVC');
            return 'critique';
        }

        // Détresse respiratoire sévère
        if (
            (symptom.includes('dyspnee') || symptom.includes('respir') || symptom.includes('souffle')) &&
            isVeryHigh
        ) {
            console.log('🔴 [ESOBuilder] CRITIQUE — Détresse respiratoire sévère');
            return 'critique';
        }

        // Hémorragie grave
        if (
            symptom.includes('hemorragie') || symptom.includes('hémorragie') ||
            (symptom.includes('saignement') && isVeryHigh)
        ) {
            console.log('🔴 [ESOBuilder] CRITIQUE — Hémorragie grave');
            return 'critique';
        }

        // Intensité très haute seule
        if (isVeryHigh) {
            console.log('🔴 [ESOBuilder] CRITIQUE — Intensité très élevée');
            return 'critique';
        }

        // ── URGENT ────────────────────────────────────────────────────────────────

        // Douleur thoracique seule
        if (isChestPain) {
            console.log('🟠 [ESOBuilder] URGENT — Douleur thoracique');
            return 'urgent';
        }

        // Dyspnée
        if (symptom.includes('dyspnee') || symptom.includes('respir')) {
            console.log('🟠 [ESOBuilder] URGENT — Dyspnée');
            return 'urgent';
        }

        // Intensité élevée (5-7)
        if (intensityNum >= 5) {
            console.log('🟠 [ESOBuilder] URGENT — Intensité élevée');
            return 'urgent';
        }

        // ── MODÉRÉ ────────────────────────────────────────────────────────────────
        if (
            intensityNum >= 3 ||
            symptom.includes('douleur') || symptom.includes('fievre') ||
            symptom.includes('nausee') || symptom.includes('saignement')
        ) {
            return 'modere';
        }

        // ── FAIBLE ────────────────────────────────────────────────────────────────
        if (s.symptom) return 'faible';

        return 'inconnue';
    }

    getSummary() {
        return {...this.data };
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