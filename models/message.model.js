const { Schema, Types, model } = require("mongoose");

const schema = new Schema(
  {
    readBy: [{ type: Types.ObjectId }],
    sender: { type: Types.ObjectId, ref: "user" },
    edited: { type: Boolean, default: false },
    sender_type: { type: String },
    chat: { type: Types.ObjectId, refPath: "sender_type" },
    content: { type: String },
    parentId: { type: Types.ObjectId, ref: "message" },
  },
  { timestamps: true }
);

const messageModel = model("message", schema);
exports.messageModel = messageModel;
