import express from "express";
import { 
  getSessions, 
  createSession, 
  getMessages, 
  sendMessage,
  deleteSession
} from "../controllers/chatController.js";

const router = express.Router();

router.get("/sessions", getSessions);
router.post("/session", createSession);
router.get("/messages/:id", getMessages);
router.post("/message", sendMessage);
router.delete("/session/:id", deleteSession);

export default router;
