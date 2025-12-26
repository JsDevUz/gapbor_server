const { Schema, Types, model } = require("mongoose");

const schema = new Schema(
  {
    pic: {
      type: String,
      default:
        "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
    },
    fullName: { type: String },
    friends: [{ type: Types.ObjectId, ref: "user" }],
    groups: [{ type: Types.ObjectId, ref: "group" }],

    type: { type: String, default: "user" },
    email: { type: String },
    password: { type: String },
    verify_code: { type: String },
    phoneNumber: { type: Number },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const UserModel = model("user", schema);
exports.UserModel = UserModel;
