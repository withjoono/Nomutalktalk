const FileSearchManager = require('./FileSearchManager');
const API_key = 'AIzaSyCvDlLAm4R_xZww84yVIBtwDciGoAffO1U';
const manager = new FileSearchManager(API_key);
(async () => {
    const newStore = await manager.createStore('mystore');
    console.log('생성된 스토아:',newStore.name);
    const storeName = 'fileSearchStores/mystore-nzhfjmb835yv'
})();