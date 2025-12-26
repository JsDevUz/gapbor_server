const { UserModel } = require("../models/user.model");
const jwt = require("jsonwebtoken");
const { decodeJWT } = require("../lib");
const { get } = require("lodash");
const { default: mongoose } = require("mongoose");
require("dotenv").config();
const ObjectId = mongoose.Types.ObjectId;
const { messageModel } = require("../models/message.model");

async function getMe(req, res) {
  console.log("salom");
  const { authorization } = req.headers;

  if (authorization && authorization.startsWith("Bearer")) {
    let token = authorization.split(" ")[1];
    const me = await decodeJWT(token);
    if (me) {
      let user = await UserModel.findOne({ _id: get(me, "userId") }).select(
        "-__v -createdAt -updatedAt -verify_code"
      );

      if (!user) return res.status(401).send({ message: "user not found" });

      await UserModel.findOne({ _id: get(me, "userId") }).then(async (e) => {
        let user = await UserModel.findOne({ _id: get(me, "userId") })
          .select("-__v -createdAt -updatedAt -verify_code")
          .populate("friends");
        res.send(user);
      });
    } else {
      console.log("mud", me);
      res.status(401).send({ message: "Muddati o'tgan" });
    }
  } else {
    console.log("amal");

    res.status(401).send({
      message: "Amal bajarish huquqi yo'q #6",
    });
  }
}

async function loginOrSignUp({ email, pic, name }, socket, callBack) {
  try {
    const user = await UserModel.findOne({ email: email });
    if (user) {
      const token = jwt.sign(
        { userId: get(user, "_id") },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: "1d",
        }
      );
      socket.handshake.query.token = `Bearer ${token}`;
      callBack({ isOk: true, token: token, user });
    } else {
      const newUser = new UserModel({
        email,
        fullName: name || "undefind",
        friends: [new ObjectId(process.env.GAP_BOR_SEO_ID)],
        pic,
      });
      const token = jwt.sign(
        { userId: get(newUser, "_id") },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: "1d",
        }
      );
      newUser.save().then(async () => {
        socket.handshake.query.token = `Bearer ${token}`;
        await UserModel.findOneAndUpdate(
          { _id: new ObjectId(process.env.GAP_BOR_SEO_ID) },
          { $push: { friends: get(newUser, "_id") } }
        );
        const newMessage = new messageModel({
          sender: new ObjectId(process.env.GAP_BOR_SEO_ID),
          content: "Xush kelibsiz!",
          sender_type: "user",
          chat: get(newUser, "_id"),
        });
        await newMessage.save().then(() => {
          callBack({ isOk: true, token: token, user: newUser });
        });
      });
    }
  } catch (e) {
    callBack({ isOk: false, message: "444" });
  }
}
module.exports = { getMe, loginOrSignUp };
