
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../data/labor_cases/final_elabor_case_전체사례_20260127_081741.json');
const targetId = '30455'; // The first ID found in temp_cases

console.log('Loading JSON...');
try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`Loaded ${data.length} cases.`);

    const index = data.findIndex(c => c.cs_id.toString() === targetId);

    if (index !== -1) {
        console.log(`Found ID ${targetId} at index ${index}`);
        console.log(`Recommendation: Use --skip=${index} to resume`);
    } else {
        console.log(`ID ${targetId} not found in JSON.`);
        // List first 5 IDs to verify format
        console.log('Sample IDs:', data.slice(0, 5).map(c => c.cs_id));
    }

} catch (e) {
    console.error('Error:', e.message);
}
