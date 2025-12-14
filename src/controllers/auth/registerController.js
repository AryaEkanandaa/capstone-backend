import bcrypt from "bcryptjs";
import { pool } from "../../db/db.js";

function generateUsername(full_name) {
  const slug = full_name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${slug}${rand}`;
}

class RegisterController {
  async handle(req, res) {
    try {
      const { full_name, email, password } = req.body;

      if (!full_name || !email || !password) {
        return res.status(400).json({ message: "Semua field wajib diisi" });
      }

      const exist = await pool.query(`SELECT id FROM users WHERE email=$1`, [email]);
      if (exist.rowCount) {
        return res.status(400).json({ message: "Email sudah digunakan" });
      }

      const hash = await bcrypt.hash(password, 10);
      const username = generateUsername(full_name);

      const result = await pool.query(
        `INSERT INTO users(full_name, username, email, password, role)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING id, full_name, username, email, role, created_at`,
  [full_name, username, email, hash, "TECHNICIAN"]
      );

      return res.status(201).json({
        message: "Registrasi berhasil!",
        user: result.rows[0],
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

export default new RegisterController();
