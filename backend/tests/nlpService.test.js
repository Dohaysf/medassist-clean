const { extractInfo, evaluateSeverity, generateReply } = require('../app/services/nlpService');

describe('extractInfo', () => {
  test('extrait symptôme et partie du corps', () => {
    const info = extractInfo('j ai mal à la tête', {});
    expect(info.symptom).toBe('douleur');
    expect(info.bodyPart).toBe('tete');
  });

  test('extrait durée avec nombre', () => {
    const info = extractInfo('depuis 3 jours', {});
    expect(info.duration).toBe('3 jours');
  });

  test('extrait intensité 5/10', () => {
    const info = extractInfo('intensité 5/10', {});
    expect(info.intensity).toBe(5);
  });

  test('extrait âge', () => {
    const info = extractInfo('j ai 45 ans', {});
    expect(info.age).toBe(45);
  });
});

describe('evaluateSeverity', () => {
  test('cardiaque → élevée', () => {
    expect(evaluateSeverity({ symptom: 'cardiaque' })).toBe('élevée');
  });
  test('intensité 8 → élevée', () => {
    expect(evaluateSeverity({ intensity: 8 })).toBe('élevée');
  });
  test('intensité 5 → moyenne', () => {
    expect(evaluateSeverity({ intensity: 5 })).toBe('moyenne');
  });
  test('intensité 3 → faible', () => {
    expect(evaluateSeverity({ intensity: 3 })).toBe('faible');
  });
});

describe('generateReply', () => {
  test('demande symptôme si manquant', () => {
    const reply = generateReply({});
    expect(reply.text).toBe('Quel est le problème principal ?');
  });
  test('demande partie du corps après symptôme', () => {
    const reply = generateReply({ symptom: 'douleur' });
    expect(reply.text).toBe('Quelle partie du corps est concernée ?');
  });
});