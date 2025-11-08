const admin = require('firebase-admin');

function initializeFirebaseAdmin() {
    if (!admin.apps.length) {
        const firebaseConfig = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        };
        admin.initializeApp({
            credential: admin.credential.cert(firebaseConfig),
            databaseURL: process.env.PUBLIC_FIREBASE_DATABASE_URL,
        });
    }
}

module.exports = async function handler(request, response) {
    try {
        initializeFirebaseAdmin();
        const database = admin.database();

        console.log('Fetching last entry from database...');
        const lastEntrySnapshot = await database.ref('history').orderByChild('timestamp').limitToLast(1).once('value');
        const lastEntryData = lastEntrySnapshot.val();
        let previousSeeds = [];
        if (lastEntryData) {
            const key = Object.keys(lastEntryData)[0];
            previousSeeds = (lastEntryData[key].seeds?.map(s => s.name) || []).sort();
        }
        console.log('Previous seeds from DB:', JSON.stringify(previousSeeds));

        console.log('Fetching new data from API...');
        const shopResponse = await fetch('https://plantsvsbrainrot.com/api/seed-shop.php');
        if (!shopResponse.ok) {
            throw new Error(`API request failed: ${shopResponse.status}`);
        }
        const shopData = await shopResponse.json();
        console.log('Raw shop data from API:', JSON.stringify(shopData));
        const currentSeeds = (shopData.seeds?.map(s => s.name) || []).sort();
        console.log('Current seeds from API:', JSON.stringify(currentSeeds));

        const areSeedsSame = JSON.stringify(currentSeeds) === JSON.stringify(previousSeeds);
        console.log(`Are seeds the same? ${areSeedsSame}`);

        if (!areSeedsSame && currentSeeds.length > 0) {
            console.log('New data found. Saving to database...');
            const timestamp = new Date().toISOString();
            const entry = {
                timestamp,
                seeds: shopData.seeds || [],
            };
            await database.ref('history').push(entry);
            console.log('Successfully saved new data.');
            return response.status(200).json({ message: 'New data saved.' });
        } else {
            console.log('No new data to save.');
            return response.status(200).json({ message: 'No new data.' });
        }
    } catch (error) {
        console.error('Cron job failed:', error);
        return response.status(500).json({ error: error.message });
    }
}