import { pool } from "../../db/db.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/tokenGenerator.js";
import { hashToken } from "../../utils/hashToken.js";
import jwt from "jsonwebtoken";
import jwtConfig from "../../config/jwt.js";

class RefreshService {
  async execute(refreshToken) {
    if (!refreshToken) throw new Error("Refresh token diperlukan");

    const data = jwt.verify(refreshToken, jwtConfig.refreshSecret);

    const hashed = hashToken(refreshToken);

    const find = await pool.query(
      `SELECT * FROM refresh_tokens WHERE user_id=$1 AND token=$2`,
      [data.id, hashed]
    );

    if (!find.rowCount) {
      throw new Error("Refresh token tidak cocok / expired / digunakan pada device lain");
    }

    const newRefresh = generateRefreshToken({
      id: data.id,
      role: data.role
    });

    const newHash = hashToken(newRefresh);

    const result = await pool.query(
      `UPDATE refresh_tokens SET token=$1 WHERE user_id=$2`,
      [newHash, data.id]
    );

    if (result.rowCount === 0) {
      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)`,
        [data.id, newHash]
      );
    }

    const newAccess = generateAccessToken({
      id: data.id,
      role: data.role
    });

    return {
      accessToken: newAccess,
      refreshToken: newRefresh
    };
  }
}

export default new RefreshService();
