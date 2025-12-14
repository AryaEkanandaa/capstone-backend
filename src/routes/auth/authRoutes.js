import express from "express";
import RegisterController from "../../controllers/auth/registerController.js";
import LoginController from "../../controllers/auth/loginController.js";
import RefreshController from "../../controllers/auth/refreshController.js";
import LogoutController from "../../controllers/auth/logoutController.js"; 

const router = express.Router();

router.post("/register", RegisterController.handle);
router.post("/login", LoginController.handle);
router.post("/refresh", RefreshController.refreshToken);
router.post("/logout", LogoutController.logout);

export default router;
