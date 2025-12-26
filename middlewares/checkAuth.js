const { UserModel } = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { decodeJWT } = require("../lib");

async function checkAuth(auth, next) {
  if (auth && auth.startsWith("Bearer")) {
    let token = auth.split(" ")[1];
    const me = await decodeJWT(token);
    if (me) {
      let usr = await UserModel.findOne({ _id: me.userId }).select(
        "-__v -createdAt -updatedAt -verify_code"
      );
      if (!usr) return res.status(400).send({ message: "usr not found" });
      await UserModel.findOne({ _id: me.userId }).then(async (e) => {
        next();
      });
    } else {
      next(new Error("Token eskirgan"));
    }
  } else {
    next(new Error("Amal bajarish huquqi yo'q"));
  }
}
module.exports = { checkAuth };
