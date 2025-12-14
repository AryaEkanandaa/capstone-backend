export function verifySystemKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      error: "Missing x-api-key header"
    });
  }

  if (apiKey !== process.env.SYSTEM_API_KEY) {
    return res.status(403).json({
      error: "Invalid system API key"
    });
  }

  next();
}
