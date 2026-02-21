// DataBase Module //
import { MongoClient } from 'mongodb';

export const Mongo = {
    async connect({ MongoConnectionString, MongodbName }) {
        try {
            const client = new MongoClient(MongoConnectionString);

            await client.connect();
            const db = client.db(MongodbName);

            this.client = client;
            this.db = db;

            console.log('Connected to MongoDB successfully!');

            return { client, db };
        }

        catch (error) {
            console.error('Error connecting to MongoDB', error);
            throw error;
        }
    }
}