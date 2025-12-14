export default {
  accessSecret: process.env.JWT_ACCESS_SECRET || "access-secret-key",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "refresh-secret-key",
  accessExpire: "3h",
  refreshExpire: "7d",
};
