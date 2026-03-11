const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function init() {
  const fullUrl = process.env.DATABASE_URL;
  if (!fullUrl) {
    console.error('DATABASE_URL not found in environment');
    process.exit(1);
  }

  // Parse URL to get the target DB name and a base URL for the 'postgres' DB
  const url = new URL(fullUrl);
  const targetDb = url.pathname.slice(1);
  url.pathname = '/postgres';
  const baseUrl = url.toString();

  // 1. Create database if it doesn't exist
  const baseClient = new Client({ connectionString: baseUrl });
  try {
    await baseClient.connect();
    const res = await baseClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDb]);
    if (res.rowCount === 0) {
      console.log(`Database ${targetDb} does not exist. Creating...`);
      await baseClient.query(`CREATE DATABASE ${targetDb}`);
      console.log(`Database ${targetDb} created.`);
    }
  } catch (err) {
    console.warn('Could not connect to base postgres database to check/create target DB. Attempting to connect to target DB directly...');
  } finally {
    await baseClient.end();
  }

  // 2. Connect to target database and run schema
  const client = new Client({ connectionString: fullUrl });
  
  try {
    await client.connect();
    console.log('Connected to database.');

    const schemaPath = path.join(__dirname, '../supabase/schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove Supabase specific commands if any that might fail locally
    // The schema I wrote is mostly standard Postgres.
    // Except 'create extension if not exists "uuid-ossp";' which requires superuser.
    // And 'alter publication' which might fail if not set up.
    
    console.log('Running schema...');
    // Split by semicolon to run individually to avoid some issues with extensions if they fail but aren't critical
    const commands = schema.split(';').filter(cmd => cmd.trim());
    
    for (let command of commands) {
      try {
        await client.query(command);
      } catch (err) {
        if (err.message.includes('already exists')) {
          // Ignore
        } else if (err.message.includes('uuid-ossp')) {
          console.warn('Warning: uuid-ossp extension failed. Make sure you have superuser rights or the extension is already enabled.');
        } else {
          console.error('Error running command:', command);
          console.error(err.message);
        }
      }
    }

    console.log('Schema initialized successfully.');
  } catch (err) {
    console.error('Failed to connect to postgres. Make sure it is running and your connection string is correct.');
    console.error(err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

init();
