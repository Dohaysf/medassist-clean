const fs = require('fs');
const path = require('path');

// Chemin vers votre fichier
const inputPath = path.join(__dirname, '../data/data_UM.json');
const outputPath = path.join(__dirname, '../data/data_UM_fixed.json');

console.log('📖 Lecture du fichier...');

try {
    let content = fs.readFileSync(inputPath, 'utf8');
    
    // 1. Supprimer les "[Saut de retour à la ligne]"
    content = content.replace(/\[Saut de retour à la ligne\]/g, '');
    
    // 2. Supprimer tous les sauts de ligne
    content = content.replace(/\n/g, '');
    
    // 3. Remplacer les doubles crochets
    content = content.replace(/\]\s*\[/g, ',');
    
    // 4. S'assurer que le tableau commence par [ et finit par ]
    if (!content.startsWith('[')) {
        content = '[' + content;
    }
    if (!content.endsWith(']')) {
        content = content + ']';
    }
    
    // 5. Ajouter des virgules entre les objets
    content = content.replace(/}\s*{/g, '},{');
    
    // 6. Valider le JSON
    const data = JSON.parse(content);
    console.log(`✅ ${data.length} entrées chargées avec succès !`);
    
    // 7. Sauvegarder le fichier corrigé
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`✅ Fichier sauvegardé: ${outputPath}`);
    
    // 8. Sauvegarder aussi comme data_UM.json
    fs.writeFileSync(path.join(__dirname, '../data/data_UM.json'), JSON.stringify(data, null, 2));
    console.log(`✅ data_UM.json mis à jour`);
    
} catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('\n📝 Le fichier contient probablement des caractères invalides.');
    console.log('Assurez-vous que le fichier commence par [ et se termine par ]');
}