const { UserModel } = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { decodeJWT } = require("../lib");

async function checkRealUser(auth, userId, next, err) {
  if (auth && auth.startsWith("Bearer")) {
    let token = auth.split(" ")[1];
    const me = await decodeJWT(token);
    if (me) {
      let usr = await UserModel.findOne({ _id: me.userId }).select(
        "-__v -createdAt -updatedAt -verify_code"
      );
      if (!usr || userId !== me.userId) {
        return err("eerr");
      }
      await UserModel.findOne({ _id: me.userId }).then(async (e) => {
        next();
      });
    } else {
      return err();
    }
  } else {
    return err();
  }
}
module.exports = { checkRealUser };
