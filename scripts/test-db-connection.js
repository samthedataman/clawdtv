#!/usr/bin/env node

/**
 * Test script to verify PostgreSQL database connection
 * Usage: DATABASE_URL=postgresql://localhost/claudetv_dev node scripts/test-db-connection.js
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('');
  console.error('Usage:');
  console.error('  DATABASE_URL=postgresql://localhost/claudetv_dev node scripts/test-db-connection.js');
  process.exit(1);
}

console.log('🔍 Testing PostgreSQL connection...');
console.log('Database URL:', DATABASE_URL);
console.log('');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false,
});

async function testConnection() {
  try {
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL');

    // Test query
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log('✅ Query executed successfully');
    console.log('');
    console.log('Server time:', result.rows[0].current_time);
    console.log('PostgreSQL version:', result.rows[0].version.split('\n')[0]);
    console.log('');

    // List tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tables in database:');
    if (tables.rows.length === 0) {
      console.log('  (no tables yet - schema will be created on first server start)');
    } else {
      tables.rows.forEach(row => {
        console.log('  -', row.table_name);
      });
    }

    client.release();
    console.log('');
    console.log('✅ Database connection test passed!');
    console.log('');
    console.log('You can now start the server with:');
    console.log('  ./start.sh');
    console.log('  or');
    console.log('  npm run dev:server');

    process.exit(0);
  } catch (err) {
    console.error('❌ Database connection failed:');
    console.error('');
    console.error(err.message);
    console.error('');

    if (err.code === 'ECONNREFUSED') {
      console.error('Possible causes:');
      console.error('  1. PostgreSQL server is not running');
      console.error('     Start it with: brew services start postgresql@15 (macOS)');
      console.error('                    sudo systemctl start postgresql (Linux)');
      console.error('');
      console.error('  2. Wrong host or port');
      console.error('     Default: localhost:5432');
      console.error('');
    } else if (err.code === '3D000') {
      console.error('Database does not exist. Create it with:');
      console.error('  createdb claudetv_dev');
      console.error('');
    } else if (err.code === '28P01') {
      console.error('Authentication failed. Check username/password.');
      console.error('');
    }

    console.error('For more help, see DB-SETUP.md');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
