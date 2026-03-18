import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = {
  query: (text, params) => pool.query(text, params),
  
  // Generic helper for common operations to mimic some Supabase-like DX if preferred
  from: (table) => {
    return {
      select: async (columns = '*', filters = {}) => {
        let sql = `SELECT ${columns} FROM ${table}`;
        const values = [];
        const filterKeys = Object.keys(filters);
        
        if (filterKeys.length > 0) {
          sql += ' WHERE ' + filterKeys.map((key, i) => {
            values.push(filters[key]);
            return `${key} = $${i + 1}`;
          }).join(' AND ');
        }
        
        const res = await pool.query(sql, values);
        return { data: res.rows, error: null };
      },
      
      insert: async (row) => {
        const keys = Object.keys(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        try {
          const res = await pool.query(sql, Object.values(row));
          return { data: res.rows[0], error: null };
        } catch (e) {
          return { data: null, error: e };
        }
      },

      upsert: async (row, onConflict) => {
        const keys = Object.keys(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const updates = keys.map((key) => `${key} = EXCLUDED.${key}`).join(', ');
        
        const sql = `
          INSERT INTO ${table} (${keys.join(', ')}) 
          VALUES (${placeholders}) 
          ON CONFLICT (${onConflict}) 
          DO UPDATE SET ${updates}
          RETURNING *`;
          
        try {
          const res = await pool.query(sql, Object.values(row));
          return { data: res.rows[0], error: null };
        } catch (e) {
          return { data: null, error: e };
        }
      }
    };
  }
};
