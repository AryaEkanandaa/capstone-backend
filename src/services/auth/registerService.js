import { pool } from "../../db/db.js";
import bcrypt from "bcryptjs";

function generateUsername(full_name) {
  const base = full_name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return base + Math.floor(Math.random() * 9999);
}

class RegisterService {
  async execute({ full_name, email, password }) {
    if (!full_name || !email || !password)
      throw new Error("full_name, email, password wajib diisi");

    const check = await pool.query(`SELECT id FROM users WHERE email=$1`, [email]);
    if (check.rowCount) throw new Error("Email sudah terdaftar");

    const hash = await bcrypt.hash(password, 10);
    const username = generateUsername(full_name);

    const userDB = await pool.query(
      `INSERT INTO users(full_name,username,email,password)
       VALUES ($1,$2,$3,$4)
       RETURNING id,full_name,username,email,created_at`,
      [full_name, username, email, hash]
    );

    return {
      message: "Register berhasil",
      user: userDB.rows[0]
    };
  }
}

export default new RegisterService();
