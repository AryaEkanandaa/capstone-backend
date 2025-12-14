import jwt from "jsonwebtoken";
import jwtConfig from "../config/jwt.js";

export const generateAccessToken = (payload) =>
  jwt.sign(payload, jwtConfig.accessSecret, {
    expiresIn: jwtConfig.accessExpire
  });

export const generateRefreshToken = (payload) =>
  jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpire
  });
