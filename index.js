const { connectDb } = require("./lib/db");
const { json, urlencoded } = require("express");
const app = require("express")();
const { notfound } = require("./routes/404");
const cors = require("cors");
const { authRouter } = require("./routes/auth.router");
const fileupload = require("express-fileupload");
const fs = require("fs");
const https = require("https");

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
  console.error("Unhandled Rejection:", ex);
  process.exit(1);
});

process.on("uncaughtException", (ex) => {
  console.error("Uncaught Exception:", ex);
  process.exit(1);
});

app.use(function (err, req, res, next) {
  console.error("Error:", err);
  res.status(500).send({
    message: "SERVER ERROR",
    type: "global",
  });
});
const server = app.listen(5001, connectDb);

// HTTPS server uchun SSL certificate
try {
  const privateKey = fs.readFileSync("localhost-key.pem", "utf8");
  const certificate = fs.readFileSync("localhost.pem", "utf8");

  const credentials = { key: privateKey, cert: certificate };
  const httpsServer = https.createServer(credentials, app);

  httpsServer.listen(5443, () => {
    console.log("HTTPS Server running on port 5443");
  });
} catch (error) {
  console.log("SSL certificate topilmadi, faqat HTTP ishlayapti");
}

const io = require("socket.io")(server, {
  pingTimeOut: 60000,
  cors: {
    origin: [
      "http://gapbor.jsdev.uz",
      "https://gapbor-frontend.vercel.app",
      "http://localhost:3000",
      "http://192.168.100.253:3000",
      "192.168.100.253:3000",
    ],
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

    if (callBack) callBack({ onlineUsers });
    io.emit("new:onlineUser", userData);
  });
  socket.on("connection_error", (err) => {
    console.error("Connection error:", err);
  });

  socket.on("disconnect", async () => {
    if (socket.userId) {
      onlineUsers = onlineUsers.filter((u) => u.userId !== socket.userId);
      io.emit("user:disconnected", socket.userId);
    }
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

  // Helper function for WebRTC call events
  const findReceiverSocket = (receiverId) => {
    return onlineUsers.find((u) => u.userId === receiverId);
  };

  const sendCallEvent = (socketId, event, data, callBack) => {
    io.to(socketId).emit(event, data);
    if (typeof callBack === "function") {
      callBack({ isOk: true });
    }
  };

  const sendCallError = (callBack, message = "User not found") => {
    if (typeof callBack === "function") {
      callBack({ isOk: false, message });
    }
  };

  // WebRTC Video Call Events
  socket.on("call:initiate", async (data, callBack) => {
    const { receiverId } = data;
    const receiverSocket = findReceiverSocket(receiverId);

    if (receiverSocket) {
      sendCallEvent(
        receiverSocket.socketId,
        "call:incoming",
        {
          callerId: data.callerId,
          callerName: data.callerName,
          callerPic: data.callerPic,
          callId: data.callId,
        },
        callBack
      );
    } else {
      sendCallError(callBack, "User not online");
    }
  });

  socket.on("call:answer", async (data, callBack) => {
    const { receiverId, callId, answer } = data;
    const receiverSocket = findReceiverSocket(receiverId);

    if (receiverSocket) {
      sendCallEvent(
        receiverSocket.socketId,
        "call:answered",
        { callId, answer },
        callBack
      );
    } else {
      sendCallError(callBack);
    }
  });

  socket.on("call:offer", async (data, callBack) => {
    const { receiverId, callId, offer } = data;
    const receiverSocket = findReceiverSocket(receiverId);

    if (receiverSocket) {
      sendCallEvent(
        receiverSocket.socketId,
        "call:offer-received",
        { callId, offer },
        callBack
      );
    } else {
      sendCallError(callBack);
    }
  });

  socket.on("call:ice-candidate", async (data, callBack) => {
    const { receiverId, callId, candidate } = data;
    const receiverSocket = findReceiverSocket(receiverId);

    if (receiverSocket) {
      sendCallEvent(
        receiverSocket.socketId,
        "call:ice-candidate",
        { callId, candidate },
        callBack
      );
    } else {
      sendCallError(callBack);
    }
  });

  socket.on("call:end", async (data, callBack) => {
    const { receiverId, callId } = data;
    const receiverSocket = findReceiverSocket(receiverId);

    if (receiverSocket) {
      sendCallEvent(
        receiverSocket.socketId,
        "call:ended",
        { callId },
        callBack
      );
    } else {
      sendCallError(callBack);
    }
  });

  socket.on("call:reject", async (data, callBack) => {
    const { receiverId, callId } = data;
    const receiverSocket = findReceiverSocket(receiverId);

    if (receiverSocket) {
      sendCallEvent(
        receiverSocket.socketId,
        "call:rejected",
        { callId },
        callBack
      );
    } else {
      sendCallError(callBack);
    }
  });
});
