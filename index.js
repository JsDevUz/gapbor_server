const { connectDb } = require("./lib/db");
const { json, urlencoded } = require("express");
const app = require("express")();
const { notfound } = require("./routes/404");
const cors = require("cors");
const { authRouter } = require("./routes/auth.router");
const fileupload = require("express-fileupload");

const corsOptions = require("./config/corsOptions");
const credentials = require("./middlewares/credentials");
const { fileRouter } = require("./routes/file.router");
const {
  getMessage,
  messageEdit,
  messageDelete,
  messageSend,
  messageRead,
} = require("./controllers/message.controller");
const {
  getChats,
  editGroup,
  leaveChat,
  createGroup,
  searchChat,
} = require("./controllers/groups.controller");
const { editProfile, searchUser } = require("./controllers/user.controller");
const { size, get } = require("lodash");
const { loginOrSignUp } = require("./controllers/auth.controller");
const { checkRealUser } = require("./middlewares/checkRealUser");
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(credentials);
app.use(fileupload());

app.use(cors(corsOptions));
app.use("/api/auth", authRouter);
app.use("/api/getFile", fileRouter);

app.use("*", notfound);

process.on("unhandledRejection", (ex) => {
  console.log(ex, "uhr");
  process.exit(1);
});
process.on("uncaughtException", (ex) => {
  console.log(ex, "unce");
  process.exit(1);
});
app.use(function (err, req, res, next) {
  console.log(err, "un");
  res.status(500).send({
    message: "SERVER ERROR",
    type: "global",
  });
});
const server = app.listen(5001, connectDb);

const io = require("socket.io")(server, {
  pingTimeOut: 60000,
  cors: {
    origin: ["http://gapbor.jsdev.uz", "http://localhost:3000"],
  },
});
let onlineUsers = [];

io.on("connection", (socket) => {
  socket.on("user:connected", async (userData, callBack) => {
    socket.join(userData);
    socket.userId = userData;
    
    // Avvalgi shu foydalanuvchining eski socket ID sini o'chirish
    onlineUsers = onlineUsers.filter((u) => u.userId !== userData);
    
    // Yangi socket ID ni qo'shish
    onlineUsers.push({ userId: userData, socketId: socket.id });
    
    console.log(socket.id,'ulandi', 'user:', userData);
    console.log('onlineUsers:', onlineUsers);
    
    callBack({ onlineUsers });
    io.emit("new:onlineUser", userData);
  });
  socket.on("connection_error", (err) => {
    console.log(err);
  });
  socket.on("disconnect", async (resons) => {
    io.emit("user:disconnected", socket.userId);
  });
  socket.on("loginOrSignup", async (data, callBack) => {
    loginOrSignUp(data, socket, callBack);
  });
  socket.on("typing:start", (room) => {
    socket.in(room).emit("typing:start", socket.userId);
  });
  socket.on("typing:stop", (room) => {
    socket.in(room).emit("typing:stop", socket.userId);
  });
  socket.on("chat:join", (room) => {
    // socket.join(room);
  });
  socket.on("search:user", async (data, callBack) => {
    const { userId } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      userId,
      (res) => {
        searchUser(data, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "err" });
      }
    );
  });
  socket.on("search:chat", async (data, callBack) => {
    const { userId } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      userId,
      (res) => {
        searchChat(data, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "err" });
      }
    );
  });
  socket.on("message:send", async (data, callBack) => {
    const { sender } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      sender,
      (res) => {
        messageSend(data, socket, io, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "errd" });
      }
    );
  });

  socket.on("message:deleted", async (data, callBack) => {
    const { userId } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      userId,
      (res) => {
        messageDelete(data, socket, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "err" });
      }
    );
  });
  socket.on("message:edited", async (data, callBack) => {
    const { userId } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      userId,
      (res) => {
        messageEdit(data, socket, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "err" });
      }
    );
  });

  socket.on("message:read", async (data, callBack) => {
    const { readerID } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      readerID,
      (res) => {
        messageRead(data, socket, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "errr" });
      }
    );
  });

  socket.on("chat:select", async (data, callBack) => {
    const { userId } = data;
    const token = get(socket, "handshake.query.token", null);

    checkRealUser(
      token,
      userId,
      (res) => {
        getMessage(data, socket, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "errr" });
      }
    );
  });

  socket.on("chat:get", async (data, callBack) => {
    const { userId } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      userId,
      (res) => {
        getChats(data, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "err" });
      }
    );
  });

  socket.on("chat:leave", async (data, callBack) => {
    const { userId } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      userId,
      (res) => {
        leaveChat(data, socket, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "err" });
      }
    );
  });

  socket.on("group:create", async (data, callBack) => {
    const { creator } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      creator,
      (res) => {
        createGroup(data, socket, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "err" });
      }
    );
  });
  socket.on("group:edit", async (data, callBack) => {
    const { creator } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      creator,
      (res) => {
        editGroup(data, socket, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "err" });
      }
    );
  });
  socket.on("edit:me", async (data, callBack) => {
    const { userId } = data;
    const token = get(socket, "handshake.query.token", null);
    checkRealUser(
      token,
      userId,
      (res) => {
        editProfile(data, callBack);
      },
      (err) => {
        callBack({ isOk: false, message: "err" });
      }
    );
  });

  // WebRTC Video Call Events
  socket.on("call:initiate", async (data, callBack) => {
    const { callerId, receiverId } = data;
    console.info('call:initiate yetib keldi serverga',onlineUsers)
    const receiverSocket = onlineUsers.find(u => u.userId === receiverId);
    if (receiverSocket) {
      console.info('call:incoming yuborilmoqda',receiverSocket.socketId,'ga');
      
      io.to(receiverSocket.socketId).emit("call:incoming", {
        callerId,
        callerName: data.callerName,
        callerPic: data.callerPic,
        callId: data.callId
      });
      if (callBack) callBack({ isOk: true, message: "Call initiated" });
    } else {
      if (callBack) callBack({ isOk: false, message: "User not online" });
    }
  });

  socket.on("call:answer", async (data, callBack) => {
    const { receiverId, callId, answer } = data;
    const receiverSocket = onlineUsers.find(u => u.userId === receiverId);
    if (receiverSocket) {
      io.to(receiverSocket.socketId).emit("call:answered", { callId, answer });
      if (callBack) callBack({ isOk: true });
    } else {
      if (callBack) callBack({ isOk: false, message: "User not found" });
    }
  });

  socket.on("call:offer", async (data, callBack) => {
    const { receiverId, callId, offer } = data;
    
    const receiverSocket = onlineUsers.find(u => u.userId === receiverId);
    console.log(data,receiverSocket,'qabul qilmoqchi',callBack);
    if (receiverSocket) {
      io.to(receiverSocket.socketId).emit("call:offer-received", { callId, offer });
      if (typeof callBack === 'function') callBack({ isOk: true });
    } else {
      if (typeof callBack === 'function') callBack({ isOk: false, message: "User not found" });
    }
  });

  socket.on("call:ice-candidate", async (data, callBack) => {
    const { receiverId, callId, candidate } = data;
    const receiverSocket = onlineUsers.find(u => u.userId === receiverId);
    if (receiverSocket) {
      io.to(receiverSocket.socketId).emit("call:ice-candidate", { callId, candidate });
      if (typeof callBack === 'function') callBack({ isOk: true });
    } else {
      if (typeof callBack === 'function') callBack({ isOk: false, message: "User not found" });
    }
  });

  socket.on("call:end", async (data, callBack) => {
    const { receiverId, callId } = data;
    const receiverSocket = onlineUsers.find(u => u.userId === receiverId);
    if (receiverSocket) {
      io.to(receiverSocket.socketId).emit("call:ended", { callId });
      if (typeof callBack === 'function') callBack({ isOk: true });
    } else {
      if (typeof callBack === 'function') callBack({ isOk: false, message: "User not found" });
    }
  });

  socket.on("call:reject", async (data, callBack) => {
    const { receiverId, callId } = data;
    const receiverSocket = onlineUsers.find(u => u.userId === receiverId);
    if (receiverSocket) {
      io.to(receiverSocket.socketId).emit("call:rejected", { callId });
      if (typeof callBack === 'function') callBack({ isOk: true });
    } else {
      if (typeof callBack === 'function') callBack({ isOk: false, message: "User not found" });
    }
  });
});
