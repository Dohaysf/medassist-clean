const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../data/data_UM_raw.txt');
const outputPath = path.join(__dirname, '../data/data_UM.json');

console.log('📖 Lecture du fichier...');

try {
    let content = fs.readFileSync(inputPath, 'utf8');
    console.log(`📏 Taille originale: ${content.length} caractères`);
    
    // Nettoyage de base
    content = content.replace(/\[Saut de retour à la ligne\]/g, '');
    content = content.replace(/\\"/g, '"');
    content = content.replace(/\r?\n/g, '');
    
    // Extraire tous les objets JSON
    const objects = [];
    let braceCount = 0;
    let start = -1;
    
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        
        if (char === '{') {
            if (braceCount === 0) {
                start = i;
            }
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && start !== -1) {
                const objStr = content.substring(start, i + 1);
                try {
                    const obj = JSON.parse(objStr);
                    objects.push(obj);
                    console.log(`✅ Objet ${objects.length} extrait`);
                } catch (e) {
                    console.log(`⚠️ Objet ignoré (erreur de parsing)`);
                }
                start = -1;
            }
        }
    }
    
    console.log(`\n📊 Total: ${objects.length} objets extraits`);
    
    if (objects.length === 0) {
        console.error('❌ Aucun objet trouvé. Vérifiez le format du fichier.');
        return;
    }
    
    // Sauvegarder le tableau JSON
    fs.writeFileSync(outputPath, JSON.stringify(objects, null, 2));
    console.log(`✅ Fichier sauvegardé: ${outputPath}`);
    
} catch (error) {
    console.error('❌ Erreur:', error.message);
}