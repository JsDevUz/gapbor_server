const { Schema, Types, model } = require("mongoose");

const schema = new Schema(
  {
    users: [{ type: Types.ObjectId, ref: "user" }],
    name: { type: String },
    pic: {
      type: String,
      default: null,
    },
    type: {
      type: String,

      default: "group",
    },

    creator: { type: Types.ObjectId },
    latestMessage: { type: Types.ObjectId, ref: "message" },
  },
  { timestamps: true }
);

const GroupModel = model("group", schema);
exports.GroupModel = GroupModel;
