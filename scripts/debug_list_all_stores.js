
const RAGAgent = require('../RAGAgent');
require('dotenv').config();

async function listAllStores() {
    const agent = new RAGAgent(process.env.GEMINI_API_KEY);
    console.log('🔍 Listing ALL stores...');

    try {
        const stores = await agent.listStores();
        console.log(`\nFound ${stores.length} stores:`);

        for (const store of stores) {
            console.log(`\n------------------------------------------------`);
            console.log(`Store Name: ${store.name}`);
            console.log(`Display Name: ${store.displayName}`);

            // Set store name to agent to list docs
            agent.storeName = store.name;
            try {
                const docs = await agent.listDocuments();
                console.log(`Document Count: ${docs.length}`);
                if (docs.length > 0) {
                    console.log(`Sample Doc: ${docs[0].displayName}`);
                }
            } catch (err) {
                console.log(`Error listing docs: ${err.message}`);
                // Try listing files via Files API as fallback or check if it's permission issue
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

listAllStores();
