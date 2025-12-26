const { default: mongoose } = require("mongoose");
const { decodeJWT } = require("../lib");
const { GroupModel } = require("../models/groups.model");
const { messageModel } = require("../models/message.model");
const { UserModel } = require("../models/user.model");
const { size, get, head } = require("lodash");
const ObjectId = mongoose.Types.ObjectId;
async function messageSend(
  { content, token, sender_type, sender, chat, parentId },
  socket,
  io,
  callBack
) {
  const { userId } = await decodeJWT(token);
  if (parentId) {
    const message = await messageModel.findOne({ _id: parentId });
    if (
      get(message, "chat").toString() !== get(chat, "_id") &&
      get(message, "sender").toString() !== get(chat, "_id")
    ) {
      return callBack({ isOk: false, message: "jo'natib bo'lmadi" });
    }
  }

  if (!sender) return res.status(400).send("xato sender");
  const newMessage = new messageModel({
    sender,
    content,
    readBy: [userId],
    sender_type,
    parentId: parentId,
    chat: get(chat, "_id"),
  });
  let last = await newMessage.save();
  await GroupModel.findOneAndUpdate(
    { _id: get(chat, "_id") },
    { $set: { latestMessage: last } }
  );
  const message = await messageModel
    .findOne({ chat: get(chat, "_id"), _id: get(last, "_id") })
    .populate({
      path: "parentId",
      populate: [{ path: "sender" }],
    })
    .populate("sender chat")
    .populate({
      path: "chat",
    });
  let isFirstMessgae = false;
  const user = await UserModel.findOne({ _id: sender });
  const resiver = await UserModel.findOne({ _id: get(chat, "_id") });
  if (!user.friends.includes(get(chat, "_id")) && sender_type === "user") {
    (isFirstMessgae = true),
      await UserModel.findOneAndUpdate(
        { _id: sender },
        { $push: { friends: get(chat, "_id") } }
      );
  }

  if (sender_type === "user" && !resiver?.friends.includes(sender)) {
    const senderData = await UserModel.findOne({ _id: sender })
      .populate("friends")
      .populate({
        path: "groups",
        populate: [{ path: "latestMessage", populate: [{ path: "sender" }] }],
      })
      .populate({
        path: "groups",
        populate: [{ path: "users" }],
      });
    socket.in(get(chat, "_id")).emit("message:newUser", senderData);

    await UserModel.findOneAndUpdate(
      { _id: get(chat, "_id") },
      { $push: { friends: sender } }
    );
  }
  if (!user.groups.includes(get(chat, "_id")) && sender_type === "group") {
    isFirstMessgae = true;

    await UserModel.findOneAndUpdate(
      { _id: sender },
      { $push: { groups: get(chat, "_id") } }
    );
    await GroupModel.findOneAndUpdate(
      { _id: new ObjectId(get(chat, "_id")) },
      { $push: { users: sender } }
    );
    const group = await GroupModel.findOne({ _id: get(chat, "_id") });
    group.users.forEach((user) => {
      socket.in(user.toString()).emit("group:change", chat);
    });
  }

  callBack({ isOk: true, message, isFirstMessgae });

  await GroupModel.updateOne(
    { _id: get(chat, "_id") },
    { updatedAt: new Date() }
  );
  if (get(chat, "type") === "group") {
    if (!get(chat, "users")) return console.log("user not found");

    get(chat, "users").forEach((user) => {
      if (get(user, "_id") == get(message, "sender._id")) return;
      socket
        .in(get(user, "_id").toString())
        .emit("message:received", { newmessage: message, isFirstMessgae });
    });
  } else {
    io.to(get(chat, "_id").toString()).emit("message:received", {
      newmessage: message,
      isFirstMessgae,
    });
  }
}
async function messageDelete({ messageId, userId }, socket, callBack) {
  const message = await messageModel
    .findOneAndDelete(
      { _id: messageId, sender: userId },
      { returnDocument: "after" }
    )
    .populate({
      path: "parentId",
      populate: [{ path: "sender" }],
    })
    .populate("sender chat")
    .populate({
      path: "chat",
    });
  if (!message) return callBack({ isOk: false, message: "o'chirib bo'lmadi" });
  const latestMessage = await messageModel
    .find({
      $or: [
        {
          $and: [
            { chat: new ObjectId(get(message, "chat._id")) },
            { sender: new ObjectId(userId) },
          ],
        },
        {
          $and: [
            { sender: new ObjectId(get(message, "chat._id")) },
            { chat: new ObjectId(userId) },
          ],
        },
      ],
    })
    .sort({ _id: -1 })
    .limit(1);
  callBack({
    isOk: true,
    id: get(message, "_id"),
    latestMessage: head(latestMessage),
  });
  let chat = get(message, "chat");
  if (get(chat, "type") === "group") {
    if (!get(chat, "users")) return console.log("user not found");

    get(chat, "users").forEach((user) => {
      if (get(user, "_id") == get(message, "sender._id")) return;

      socket
        .in(get(user, "_id").toString())
        .emit("deleted:message:received", message);
    });
  } else {
    socket
      .in(get(chat, "_id").toString())
      .emit("deleted:message:received", message);
  }
}
async function messageEdit({ content, userId, messageId }, socket, callBack) {
  const id = messageId;
  const message = await messageModel
    .findOneAndUpdate(
      { _id: id, sender: userId },
      { $set: { content: content } },
      { returnDocument: "after" }
    )
    .populate({
      path: "parentId",
      populate: [{ path: "sender" }],
    })
    .populate("sender chat")
    .populate({
      path: "chat",
    });

  if (!message)
    return callBack({ isOk: false, message: "o'zgartrib bo'lmadi" });

  callBack({ isOk: true, message });

  let chat = get(message, "chat");
  if (get(chat, "type") === "group") {
    if (!get(chat, "users")) return console.log("user not found");

    get(chat, "users").forEach((user) => {
      if (get(user, "_id") == get(message, "sender._id")) return;

      socket
        .in(get(user, "_id").toString())
        .emit("edited:message:received", message);
    });
  } else {
    socket
      .in(get(chat, "_id").toString())
      .emit("edited:message:received", message);
  }
}
async function messageRead({ message, readerID }, socket, callBack) {
  const user = await UserModel.findOne({ _id: readerID });

  if (!size(user)) return callBack({ isOk: false, message: "o'qib bo'lmadi" });

  let a = await messageModel.updateMany(
    { _id: get(message, "_id"), readBy: { $ne: readerID } },

    { $push: { readBy: readerID } }
  );
  const readedMessage = await messageModel.findOne({
    _id: get(message, "_id"),
  });
  socket.in(get(message, "sender._id")).emit("yourMessage:read", readedMessage);
  callBack({ isOk: true, message: "o'qiildi" });
}
async function getMessage({ chatId, userId }, socket, callBack) {
  let type = (await GroupModel.findOne({ _id: chatId }))
    ? "group"
    : (await UserModel.findOne({ _id: chatId }))
    ? "user"
    : false;
  let condition =
    type === "group"
      ? { chat: new ObjectId(chatId) }
      : {
          $or: [
            {
              $and: [
                { chat: new ObjectId(chatId) },
                { sender: new ObjectId(userId) },
              ],
            },
            {
              $and: [
                { sender: new ObjectId(chatId) },
                { chat: new ObjectId(userId) },
              ],
            },
          ],
        };
  const mes = await messageModel.findOne(condition).select("sender_type -_id");
  let sender_type = "user";
  if (mes) sender_type = mes;
  const groupedMessages = await messageModel.aggregate([
    {
      $match: condition,
    },

    {
      $lookup: {
        from: `${sender_type}s`,
        localField: "chat",
        foreignField: "_id",
        as: "chat",
      },
    },
    {
      $set: {
        chat: { $arrayElemAt: ["$chat", 0] },
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "sender",
        foreignField: "_id",
        as: "sender",
      },
    },
    {
      $set: {
        sender: { $arrayElemAt: ["$sender", 0] },
      },
    },

    {
      $lookup: {
        from: "messages",
        localField: "parentId",
        foreignField: "_id",
        as: "parentId",
      },
    },
    {
      $set: {
        parentId: { $arrayElemAt: ["$parentId", 0] },
      },
    },

    {
      $project: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
        date: new Date("$createdAd").toLocaleString("en-US", {
          timeZone: "Asia/Tashkent",
        }),
        content: 1,
        chat: 1,
        readBy: 1,
        sender: 1,
        createdAt: 1,
        parentId: 1,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y/%m/%d", date: "$createdAt" } },
        messages: { $push: "$$ROOT" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  if (!type) return callBack({ isOk: false, message: "olib bo'lmadi" });

  let chat = [];
  if (type === "group") {
    chat = await GroupModel.findOne({ _id: chatId }).populate(
      "users latestMessage"
    );
    messages = await messageModel
      .find({ chat: chatId })
      .populate({
        path: "parentId",
        populate: [{ path: "sender" }],
      })
      .populate("sender chat");
  } else {
    chat = await UserModel.findOne({ _id: chatId });

    messages = await messageModel
      .find({
        $or: [
          { $and: [{ chat: chatId }, { sender: userId }] },
          { $and: [{ sender: chatId }, { chat: userId }] },
        ],
      })
      .populate({
        path: "parentId",
        populate: [{ path: "sender" }],
      })
      .populate("sender chat");
  }
  callBack({ messages: groupedMessages, chat, isOk: true });
}

module.exports = {
  getMessage,
  messageEdit,
  messageSend,
  messageRead,
  messageDelete,
};
