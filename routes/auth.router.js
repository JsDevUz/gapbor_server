const { Router } = require("express");
const { getMe } = require("../controllers/auth.controller");
const router = Router();

//user
router.post("/getme", getMe);

module.exports = { authRouter: router };
