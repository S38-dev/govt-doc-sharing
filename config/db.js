const { Client } = require('pg');


const client = new Client({
  user:process.env.DB_USER,
  host: process.env.DB_HOST,
  database:process.env.Database_name,
  password:process.env.DB_PASSWORD,
  port: 5432,
});


const originalQuery = client.query.bind(client);


client.query = async (text, params) => {
  try {
    const start = Date.now();
    const result = await originalQuery(text, params);
    const duration = Date.now() - start;
    console.log(`📝 Executed query: ${text} (${duration}ms)`);
    return result;
  } catch (error) {
    console.error('🚨 Query error:', error);
    throw error;
  }
};

async function connectDB() {
  try {
    await client.connect();
    console.log('✅ PostgreSQL connected successfully');
    return client;
  } catch (error) {
    console.error('❌ Connection error:', error);
    process.exit(1);
  }
}

module.exports = { db: client, connectDB };