import { pool } from "../../db/db.js";
import { hashToken } from "../../utils/hashToken.js";

class LogoutService {
  async execute(refreshToken) {
    if (!refreshToken) return;

    const hashed = hashToken(refreshToken);

    await pool.query(
      `DELETE FROM refresh_tokens WHERE token = $1`,
      [hashed]
    );
  }
}

export default new LogoutService();
