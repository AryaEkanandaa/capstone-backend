import logoutService from "../../services/auth/logoutService.js";

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    await logoutService.execute(refreshToken);

    res.json({
      status: "success",
      message: "Logout berhasil",
    });
  } catch (err) {
    next(err);
  }
};

export default { logout };
