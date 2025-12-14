import loginService from "../../services/auth/loginService.js";

class LoginController {
  async handle(req, res) {
    try {
      const result = await loginService.execute(req.body);

      return res.json({
        message: "Login berhasil",
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });

    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
}

export default new LoginController();
