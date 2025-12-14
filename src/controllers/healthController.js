export const healthCheck = (req, res) => {
  return res.json({
    status: "ok",
    message: "Backend API is running",
    timestamp: new Date().toISOString()
  });
};
