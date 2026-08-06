require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Connecting to Neon DB...");
  const client = await pool.connect();
  try {
    console.log("Beginning transaction...");
    await client.query('BEGIN');
    
    console.log("Creating/checking tables...");
    // Check tables...
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Check if initial seeding has already been completed
    console.log("Checking if seeding completed...");
    const seedCheck = await client.query("SELECT value FROM system_metadata WHERE key = 'initial_seed_completed'");
    const isSeedCompleted = seedCheck.rows.length > 0 && seedCheck.rows[0].value === 'true';
    console.log("isSeedCompleted:", isSeedCompleted);
    
    console.log("Committing transaction...");
    await client.query('COMMIT');
    console.log("Database initialized successfully!");
  } catch (err) {
    console.log("Error during initialization, rolling back...");
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
