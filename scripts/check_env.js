
const fs = require('fs');
const path = require('path');

const progressPath = path.join(__dirname, 'import_progress.json');
console.log(`Current dir: ${__dirname}`);
console.log(`Progress path: ${progressPath}`);
console.log(`Exists? ${fs.existsSync(progressPath)}`);

if (fs.existsSync(progressPath)) {
    console.log(`Content: ${fs.readFileSync(progressPath, 'utf-8')}`);
}
