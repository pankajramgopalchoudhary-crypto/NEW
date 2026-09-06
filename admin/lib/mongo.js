import { MongoClient } from 'mongodb';

let client;
let dbInstance;

export async function getDb() {
  if (!dbInstance) {
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    dbInstance = client.db(process.env.DB_NAME || 'smartsetupuae_admin');
  }
  return dbInstance;
}

export async function col(name) {
  const db = await getDb();
  return db.collection(name);
}
