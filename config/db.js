const { Client } = require('pg');

// Create client instance
const client = new Client({
  user: '***REMOVED***',
  host: '***REMOVED***',
  database: '***REMOVED***',
  password: '***REMOVED***',
  port: 5432,
});

// Preserve original query method
const originalQuery = client.query.bind(client);

// Add enhanced query method with logging
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