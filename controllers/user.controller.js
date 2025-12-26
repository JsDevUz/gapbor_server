const { size } = require("lodash");
const { UserModel } = require("../models/user.model");
const fs = require("fs-extra");
require("dotenv").config();

async function searchUser({ user, userId }, callBack) {
  if (size(user) < 2) return;

  const users = await UserModel.find({
    fullName: { $regex: ".*" + user + ".*", $options: "i" },
    _id: { $ne: userId },

    _id: { $ne: process.env.GAP_BOR_SEO_ID },
  });
  callBack({ isOk: true, users });
}

async function editProfile({ fullName, userId, pic }, callBack) {
  let userPic = pic;
  const moveTempImg = (img) => {
    fs.move(`./uploads/temp/${img}`, `./uploads/${img}`, (err) => {
      if (err) return callBack({ isOk: false, message: "o'zgartrib bo'lmadi" });
    });
  };
  if (pic.includes("temp/")) {
    userPic = pic.split("temp/")[1];
    moveTempImg(userPic);
  }
  await UserModel.findOneAndUpdate(
    { _id: userId },
    { $set: { fullName, pic: userPic } }
  );
  const me = await UserModel.findOne({ _id: userId });
  callBack({ isOk: true, me });
}
module.exports = {
  searchUser,
  editProfile,
};
