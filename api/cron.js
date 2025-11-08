import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.development.local');
dotenv.config({ path: envPath });

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

export default async function handler(request, response) {
    try {
        initializeFirebaseAdmin();
        const database = admin.database();

        const lastEntrySnapshot = await database.ref('history').orderByChild('timestamp').limitToLast(1).once('value');
        const lastEntryData = lastEntrySnapshot.val();
        let previousSeeds = [];
        if (lastEntryData) {
            const key = Object.keys(lastEntryData)[0];
            previousSeeds = (lastEntryData[key].seeds?.map(s => s.name) || []).sort();
        }

        const shopResponse = await fetch('https://plantsvsbrainrot.com/api/seed-shop.php');
        if (!shopResponse.ok) {
            throw new Error(`API request failed: ${shopResponse.status}`);
        }
        const shopData = await shopResponse.json();
        const currentSeeds = (shopData.seeds?.map(s => s.name) || []).sort();

        const areSeedsSame = JSON.stringify(currentSeeds) === JSON.stringify(previousSeeds);

        if (!areSeedsSame && currentSeeds.length > 0) {
            const timestamp = new Date().toISOString();
            const entry = {
                timestamp,
                seeds: shopData.seeds || [],
            };
            await database.ref('history').push(entry);
            return response.status(200).json({ message: 'New data saved.' });
        } else {
            return response.status(200).json({ message: 'No new data.' });
        }
    } catch (error) {
        console.error('Cron job failed:', error);
        return response.status(500).json({ error: error.message });
    }
}