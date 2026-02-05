
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const progressPath = path.join(__dirname, 'import_progress.json');
const scriptPath = path.join(__dirname, 'import_labor_cases_json.js');

console.log('🔄 Resume Import Wrapper');

let skip = 0;

if (fs.existsSync(progressPath)) {
    try {
        const data = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
        if (data.lastIndex) {
            skip = data.lastIndex;
            console.log(`✅ Found progress file: Resuming from index ${skip}`);
        } else {
            console.log('⚠️  Progress file found but no lastIndex. Starting from 0.');
        }
    } catch (e) {
        console.error(`❌ Error reading progress file: ${e.message}`);
    }
} else {
    console.log('⚠️  No progress file found. Starting from 0.');
}

console.log(`🚀 Launching import script with --skip=${skip}`);

const child = spawn('node', [scriptPath, `--skip=${skip}`], {
    stdio: 'inherit',
    shell: true
});

child.on('close', (code) => {
    console.log(`Import process exited with code ${code}`);
});
