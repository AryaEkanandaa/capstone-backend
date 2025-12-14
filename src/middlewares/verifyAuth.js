import jwt from "jsonwebtoken";
import jwtConfig from "../config/jwt.js";

export const verifyAuth = (req, res, next) => {
  let token = null;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }

  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Access token tidak ditemukan" });
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.accessSecret);
    req.user = decoded;
    next();

  } catch (err) {
    return res.status(401).json({
      error:
        err.name === "TokenExpiredError"
          ? "Token expired — silakan refresh"
          : "Token tidak valid",
    });
  }
};
