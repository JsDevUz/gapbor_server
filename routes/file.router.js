const { Router } = require("express");
const {
  getFile,
  getFileTemp,
  uploadImg,
} = require("../controllers/file.controller");
const router = Router();

//user
router.get("/:imgId", getFile);
router.get("/temp/:imgId", getFileTemp);
router.post("/upload", uploadImg);

module.exports = { fileRouter: router };
