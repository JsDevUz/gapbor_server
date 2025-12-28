const { Router } = require("express");
const { getMe, register, login } = require("../controllers/auth.controller");
const router = Router();

//user
router.post("/getme", getMe);

// Email va password bilan auth
router.post("/register", register);
router.post("/login", login);

module.exports = { authRouter: router };
