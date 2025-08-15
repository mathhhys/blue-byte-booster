require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to DB...');
    const before = await pool.query("SELECT id, clerk_id, email, plan_type, credits FROM users WHERE plan_type = 'pro' AND credits = 525");
    console.log('Found rows (before):', before.rows.length);
    console.table(before.rows);

    const res = await pool.query("UPDATE users SET credits = 500 WHERE plan_type = 'pro' AND credits = 525 RETURNING id, clerk_id, email, credits");
    console.log('Updated rows:', res.rowCount);
    console.table(res.rows);
  } catch (err) {
    console.error('Error running update:', err);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('Done.');
  }
})();