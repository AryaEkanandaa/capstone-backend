// src/services/auth/loginService.js
import { pool } from "../../db/db.js";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../../utils/tokenGenerator.js";
import { hashToken } from "../../utils/hashToken.js";

class LoginService {
  async execute({ email, password }) {
    const r = await pool.query(`SELECT * FROM users WHERE email=$1`, [email]);
    if (!r.rowCount) throw new Error("Akun tidak ditemukan");

    const user = r.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error("Password salah");

    const accessToken = generateAccessToken({
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role
    });


    const hashed = hashToken(refreshToken);

    await pool.query(`DELETE FROM refresh_tokens WHERE user_id=$1`, [user.id]);
    await pool.query(`INSERT INTO refresh_tokens(user_id, token) VALUES($1,$2)`, [
      user.id,
      hashed
    ]);

    return {
      message: "Login berhasil",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email
      }
    };
  }
}

export default new LoginService();
