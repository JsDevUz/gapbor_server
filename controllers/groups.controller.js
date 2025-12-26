const { default: mongoose } = require("mongoose");
const { GroupModel } = require("../models/groups.model");
const { messageModel } = require("../models/message.model");
const { UserModel } = require("../models/user.model");
const fs = require("fs-extra");
const { size, get, head } = require("lodash");
const ObjectId = mongoose.Types.ObjectId;

async function getChats({ userId }, callBack) {
  const userm = await UserModel.findOne({ _id: userId });

  const friends = await UserModel.aggregate([
    { $match: { _id: { $in: get(userm, "friends") } } },
    {
      $lookup: {
        from: "messages",
        as: "latest",
        let: {
          friendId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $or: [
                {
                  $and: [
                    {
                      $expr: {
                        $eq: ["$$friendId", "$sender"],
                      },
                    },
                    {
                      $expr: {
                        $eq: [new ObjectId(userId), "$chat"],
                      },
                    },
                  ],
                },

                {
                  $and: [
                    {
                      $expr: {
                        $eq: ["$$friendId", "$chat"],
                      },
                    },
                    {
                      $expr: {
                        $eq: [new ObjectId(userId), "$sender"],
                      },
                    },
                  ],
                },
              ],
            },
          },
          { $sort: { _id: -1 } },
          { $limit: 1 },
        ],
      },
    },
    {
      $addFields: {
        latestMessage: { $arrayElemAt: ["$latest", 0] },
      },
    },
  ]);
  const users = await UserModel.findOne({ _id: userId })
    .populate("friends")
    .populate({
      path: "groups",
      populate: [{ path: "latestMessage", populate: [{ path: "sender" }] }],
    })
    .populate({
      path: "groups",
      populate: [{ path: "users" }],
    });

  const Chats = [...friends, ...get(users, "groups")];
  let chatsId = [];
  let friendsId = [];
  for (const chat of Chats) {
    if (chat.type === "group") chatsId.push(get(chat, "_id"));
    else if (chat.type === "user") friendsId.push(get(chat, "_id"));
  }
  let notifications = [];
  notifications = await messageModel
    .find({
      $or: [
        {
          $and: [
            {
              $or: [
                {
                  $and: [
                    { chat: { $in: chatsId } },
                    { sender: { $in: friendsId } },
                  ],
                },
                {
                  $and: [
                    { sender: { $in: chatsId } },
                    { chat: { $in: friendsId } },
                  ],
                },
              ],
            },
            {
              sender_type: "group",
            },
          ],
        },
        {
          $and: [
            {
              sender_type: "user",
            },
            {
              $or: [
                {
                  $and: [{ chat: userId }, { sender: { $in: friendsId } }],
                },
                {
                  $and: [{ sender: userId }, { chat: { $in: friendsId } }],
                },
              ],
            },
          ],
        },
      ],

      readBy: { $ne: userId },
    })
    .populate({
      path: "parentId",
      populate: [{ path: "sender" }],
    })
    .populate("sender chat")
    .populate({
      path: "chat",
    });
  callBack({ isOk: true, chats: Chats, notify: notifications });
}

async function searchChat({ title, userId }, callBack) {
  if (size(title) < 2) return;
  let resp = [];
  const Chats = await GroupModel.find({
    name: { $regex: ".*" + title + ".*", $options: "i" },
  }).populate("users");
  const Users = await UserModel.find({
    fullName: { $regex: ".*" + title + ".*", $options: "i" },
    _id: { $ne: userId },
  });
  resp = Chats.concat(Users);
  callBack({ isOk: true, data: resp });
}
async function leaveChat({ chat, userId, token }, socket, callBack) {
  if (chat.type === "group") {
    let group = await GroupModel.findOne({ _id: get(chat, "_id") });
    let newusr = get(group, "users").filter(
      (user) => get(user, "_id") != userId
    );

    let user = await UserModel.findOne({ _id: userId });
    let newGroups = user.groups.filter(
      (group) => group.toString() !== get(chat, "_id")
    );
    await UserModel.findOneAndUpdate(
      { _id: userId },
      { $set: { groups: newGroups } }
    );

    await GroupModel.findOneAndUpdate(
      { _id: get(chat, "_id") },
      { $set: { users: newusr } }
    );
    chat.users.forEach((user) => {
      socket.in(user._id.toString()).emit("group:change", chat);
    });
    callBack({ isOk: true });
  } else {
    let user = await UserModel.findOne({ _id: userId });
    let newFriend = user.friends.filter(
      (friend) => friend.toString() !== get(chat, "_id")
    );
    await UserModel.findOneAndUpdate(
      { _id: userId },
      { $set: { friends: newFriend } }
    );

    callBack({ isOk: true });
  }
}
async function createGroup(
  { name, chatLogo, users, creator },
  socket,
  callBack
) {
  const newChatLogo = chatLogo?.includes("temp/")
    ? chatLogo?.split("temp/")[1]
    : chatLogo;

  const newChat = new GroupModel({
    name,
    pic: newChatLogo,
    users,
    creator,
  });
  const moveTempImg = (img) => {
    fs.move(`./uploads/temp/${img}`, `./uploads/${img}`, (err) => {
      if (err) throw err;
    });
  };
  if (newChatLogo) {
    moveTempImg(newChatLogo);
  }
  newChat.save().then(async () => {
    let nch = await GroupModel.findOne({ _id: get(newChat, "_id") }).populate(
      "users"
    );
    for (const userId of users) {
      await UserModel.findOneAndUpdate(
        { _id: userId },
        { $push: { groups: get(newChat, "_id") } }
      );
    }

    users.forEach(async (user) => {
      socket.in(get(user, "_id").toString()).emit("addyou", newChat);
    });
    callBack({ isOk: true, chat: nch });
  });
}

async function editGroup(
  { chatId, name, kikedUsersList, users, addedUsersList, pic, creator },
  socket,
  callBack
) {
  await GroupModel.findOneAndUpdate(
    { _id: chatId },
    { $set: { name: name, pic, users: users } }
  );
  const chat = await GroupModel.findOne({ _id: chatId })
    .populate("latestMessage users")
    .populate({
      path: "latestMessage",
      populate: [{ path: "sender" }],
    });

  kikedUsersList.forEach(async (user) => {
    await UserModel.findOneAndUpdate(
      { _id: get(user, "_id") },
      { $push: { groups: chatId } }
    );
    socket.in(user._id.toString()).emit("addyou", chat);
  });
  addedUsersList.forEach(async (user) => {
    await UserModel.findOneAndUpdate(
      { _id: get(user, "_id") },
      { $pull: { groups: chatId } }
    );

    socket.in(user._id.toString()).emit("kikyou", chat);
  });
  chat.users.forEach((user) => {
    if (get(user, "_id") == creator) return;
    socket.in(user._id.toString()).emit("group:change", chat);
  });
  callBack({ isOk: true, chat: chat });
}

module.exports = {
  editGroup,
  createGroup,
  leaveChat,
  searchChat,
  getChats,
};
