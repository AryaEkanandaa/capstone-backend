import refreshService from "../../services/auth/refreshService.js";

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const data = await refreshService.execute(refreshToken);

    res.json({
      status: "success",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export default { refreshToken };
