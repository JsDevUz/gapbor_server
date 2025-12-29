const { connectDb } = require("./lib/db");
const { json, urlencoded } = require("express");
const app = require("express")();
const { UserModel } = require("./models/user.model");

const { notfound } = require("./routes/404");
const cors = require("cors");
const { authRouter } = require("./routes/auth.router");
const fileupload = require("express-fileupload");
const fs = require("fs");
const https = require("https");

const corsOptions = require("./config/corsOptions");
const credentials = require("./middlewares/credentials");
const { fileRouter } = require("./routes/file.router");
const meetRouter = require("./routes/meet.router");
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
app.use("/api/meet", meetRouter);
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
      console.log('User disconnected:', socket.userId);

      // Barcha meet roomlardan chiqarish va boshqa participantlarga xabar berish
      const rooms = Array.from(socket.rooms).filter(room => room.startsWith('meet:'));
      rooms.forEach(room => {
        const meetId = room.replace('meet:', '');
        console.log(`Notifying meet ${meetId} that user ${socket.userId} left`);
        socket.to(room).emit("meet:user-left", {
          meetId,
          userId: socket.userId
        });
      });

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

  // Meet socket eventlari
  socket.on("meet:create", async (data, callBack) => {
    const { userId, title, description } = data;
    const token = get(socket, "handshake.query.token", null);
    
    checkRealUser(
      token,
      userId,
      async (res) => {
        try {
          const Meet = require("./models/Meet");
          const { UserModel: User } = require("./models/user.model");
          const { v4: uuidv4 } = require("uuid");

          const meetId = uuidv4().slice(0, 8);
          const meet = new Meet({
            meetId,
            title: title || 'Video Meeting',
            description: description || '',
            creator: userId,
            participants: [userId],
            isActive: true,
            createdAt: new Date()
          });

          await meet.save();
          const creator = await User.findById(userId).select('fullName pic');
          
          // Meet roomiga creator ni qo'shish
          socket.join(`meet:${meetId}`);
          
          if (callBack) callBack({ 
            isOk: true, 
            meet: {
              ...meet.toObject(),
              creator: {
                id: creator._id,
                fullName: creator.fullName,
                pic: creator.pic
              }
            }
          });
        } catch (error) {
          console.error('Meet create error:', error);
          if (callBack) callBack({ isOk: false, message: "Meet yaratishda xatolik" });
        }
      },
      (err) => {
        if (callBack) callBack({ isOk: false, message: "Auth error" });
      }
    );
  });

  socket.on("meet:join-request", async (data, callBack) => {
    const { meetId, userId } = data;
    const token = get(socket, "handshake.query.token", null);
    
    console.log('Meet join request received:', { meetId, userId, socketId: socket.id, hasToken: !!token });
    
    checkRealUser(
      token,
      userId,
      async (res) => {
        try {
          const Meet = require("./models/Meet");
          const { UserModel: User } = require("./models/user.model");;

          const meet = await Meet.findOne({ meetId, isActive: true })
            .populate('creator', 'fullName pic')
            .populate('participants', 'fullName pic');

          if (!meet) {
            console.log('Meet not found:', meetId);
            return callBack({ isOk: false, message: "Meet topilmadi" });
          }

          const user = await User.findById(userId).select('fullName pic');
          console.log('User found:', user?.fullName);
          
          // Creator ga join request yuborish
          const creatorSocket = onlineUsers.find(u => u.userId === meet.creator._id.toString());
          console.log('Looking for creator ID:', meet.creator._id.toString());
          console.log('Online users:', onlineUsers.map(u => ({ userId: u.userId, socketId: u.socketId })));
          console.log('Creator socket:', creatorSocket ? creatorSocket.socketId : 'not found');
          
          if (creatorSocket) {
            io.to(creatorSocket.socketId).emit("meet:join-request-received", {
              meetId,
              user: {
                id: user._id,
                fullName: user.fullName,
                pic: user.pic
              },
              socketId: socket.id
            });
            console.log('Join request sent to creator');
          } else {
            console.log('Creator not online');
          }

          if (callBack) callBack({ isOk: true, meet });
        } catch (error) {
          console.error('Meet join request error:', error);
          if (callBack) callBack({ isOk: false, message: "Join request error" });
        }
      },
      (err) => {
        console.log('Auth error for meet join request:', err);
        if (callBack) callBack({ isOk: false, message: "Auth error" });
      }
    );
  });

  socket.on("meet:approve-request", async (data, callBack) => {
    const { meetId, userId, creatorId, userSocketId } = data;
    const token = get(socket, "handshake.query.token", null);
    
    console.log('meet:approve-request received:', { meetId, userId, creatorId, userSocketId });
    
    checkRealUser(
      token,
      creatorId,
      async (res) => {
        console.log('checkRealUser success for approve request');
        try {
          const Meet = require("./models/Meet");

          const meet = await Meet.findOne({ meetId, creator: creatorId, isActive: true });
          if (!meet) {
            console.log('Meet not found for approve request');
            return callBack({ isOk: false, message: "Meet topilmadi" });
          }

          if (!meet.participants.includes(userId)) {
            meet.participants.push(userId);
            await meet.save();
            console.log('User added to meet participants');
          }

          // User ga ruxsat berish
          console.log('Sending meet:join-approved to user socket:', userSocketId);
          
          io.to(userSocketId).emit("meet:join-approved", {
            meetId,
            approved: true
          });
          
          console.log('meet:join-approved sent to user');

          // User ni meet roomiga qo'shish
          // const userSocket = onlineUsers.find(u => u.socketId === userSocketId);
          const userSocket = io.sockets.sockets.get(userSocketId);
          if (userSocket) {
            io.sockets.sockets.get(userSocketId)?.join(`meet:${meetId}`);
          }
userSocket.join(`meet:${meetId}`);
          // Barcha participantlarga yangi user haqida xabar
          const { UserModel: User } = require("./models/user.model");;
          const newUser = await User.findById(userId).select('fullName pic');
          io.to(`meet:${meetId}`).emit("meet:user-joined", {
            meetId,
  user: newUser,
  userId: newUser._id
          });

          if (callBack) callBack({ isOk: true });
        } catch (error) {
          console.error('Meet approve error:', error);
          if (callBack) callBack({ isOk: false, message: "Approve error" });
        }
      },
      (err) => {
        if (callBack) callBack({ isOk: false, message: "Auth error" });
      }
    );
  });

  socket.on("meet:join-room", async (data, callBack) => {
    const { meetId, userId } = data;
    console.log('meet:join-room received:', { meetId, userId, socketId: socket.id });

    try {
      const Meet = require("./models/Meet");
      const { UserModel } = require("./models/user.model");

      // Meetni topish
      const meet = await Meet.findOne({ meetId, isActive: true })
        .populate('participants', 'fullName pic _id');

      console.log('Meet found:', !!meet, 'meetId:', meetId, 'participants count:', meet?.participants?.length || 0);
      if (meet?.participants) {
        console.log('Participants:', meet.participants.map(p => ({ id: p._id, name: p.fullName })));
      }

      if (!meet) {
        console.log('Meet not found for join-room:', meetId);
        if (callBack) callBack({ isOk: false, message: "Meet topilmadi" });
        return;
      }

      // Socketni meet roomiga qo'shish
      socket.join(`meet:${meetId}`);
      console.log('Socket joined meet room:', meetId);

      // Qolgan participantlarga bu user qayta qo'shilganini xabar berish
      const currentUser = await UserModel.findById(userId).select('fullName pic _id');
      socket.to(`meet:${meetId}`).emit("meet:user-joined", {
        meetId,
        user: currentUser,
        userId: currentUser._id
      });

      // Yangi qo'shilgan userga mavjud participantlar haqida xabar berish
      const existingParticipants = meet.participants.filter(p => p._id.toString() !== userId);
      console.log(`Sending ${existingParticipants.length} existing participants to user ${userId}`);
      existingParticipants.forEach((participant, index) => {
        console.log(`Sending meet:user-joined for participant ${index + 1}:`, participant._id);
        socket.emit("meet:user-joined", {
          meetId,
          user: participant,
          userId: participant._id
        });
      });

      console.log(`User ${userId} rejoined meet ${meetId} with ${existingParticipants.length} existing participants`);

      // Check if current user is the creator
      const isCreator = meet.creator.toString() === userId;
      console.log(`User ${userId} is creator: ${isCreator} (meet creator: ${meet.creator})`);

      if (callBack) callBack({ isOk: true, isCreator });
    } catch (error) {
      console.error('meet:join-room error:', error);
      if (callBack) callBack({ isOk: false, message: "Join room error" });
    }
  });

  // WebRTC signaling handlers
  socket.on("meet:offer", async (data, callBack) => {
    const { meetId, toUserId, fromUserId, offer } = data;
    console.log('meet:offer received:', { meetId, toUserId, fromUserId });
    
    const targetSocket = onlineUsers.find(u => u.userId === toUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("meet:offer", {
        meetId,
        fromUserId,
        offer
      });
      console.log('Offer forwarded to:', toUserId);
      if (callBack) callBack({ isOk: true });
    } else {
      console.log('Target user not online:', toUserId);
      if (callBack) callBack({ isOk: false, message: "User not online" });
    }
  });

  socket.on("meet:answer", async (data, callBack) => {
    const { meetId, toUserId, fromUserId, answer } = data;
    console.log('meet:answer received:', { meetId, toUserId, fromUserId });
    
    const targetSocket = onlineUsers.find(u => u.userId === toUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("meet:answer", {
        meetId,
        fromUserId,
        answer
      });
      console.log('Answer forwarded to:', toUserId);
      if (callBack) callBack({ isOk: true });
    } else {
      console.log('Target user not online:', toUserId);
      if (callBack) callBack({ isOk: false, message: "User not online" });
    }
  });

  socket.on("meet:ice-candidate", async (data, callBack) => {
    const { meetId, toUserId, fromUserId, candidate } = data;
    console.log('meet:ice-candidate received:', { meetId, toUserId, fromUserId });
    
    const targetSocket = onlineUsers.find(u => u.userId === toUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("meet:ice-candidate", {
        meetId,
        fromUserId,
        candidate
      });
      console.log('ICE candidate forwarded to:', toUserId);
      if (callBack) callBack({ isOk: true });
    } else {
      console.log('Target user not online:', toUserId);
      if (callBack) callBack({ isOk: false, message: "User not online" });
    }
  });

  socket.on("meet:end", async (data, callBack) => {
    const { meetId, userId } = data;
    const token = get(socket, "handshake.query.token", null);
    
    checkRealUser(
      token,
      userId,
      async (res) => {
        try {
          const Meet = require("./models/Meet");

          const meet = await Meet.findOne({ meetId, creator: userId, isActive: true });
          if (!meet) {
            return callBack({ isOk: false, message: "Meet topilmadi" });
          }

          meet.isActive = false;
          meet.endedAt = new Date();
          await meet.save();

          // Barcha participantlarga meet tugaganligi haqida xabar
          io.to(`meet:${meetId}`).emit("meet:ended", {
            meetId,
            message: "Meet tugatildi"
          });

          // Meet roomidan barchasini chiqarish
          const sockets = await io.in(`meet:${meetId}`).fetchSockets();
          sockets.forEach(s => s.leave(`meet:${meetId}`));

          if (callBack) callBack({ isOk: true });
        } catch (error) {
          console.error('Meet end error:', error);
          if (callBack) callBack({ isOk: false, message: "End error" });
        }
      },
      (err) => {
        if (callBack) callBack({ isOk: false, message: "Auth error" });
      }
    );
  });

  socket.on("meet:leave", async (data, callBack) => {
    const { meetId, userId } = data;
    
    try {
      socket.leave(`meet:${meetId}`);
      
      // Barcha participantlarga user chiqqanligi haqida xabar
      io.to(`meet:${meetId}`).emit("meet:user-left", {
        meetId,
        userId
      });

      if (callBack) callBack({ isOk: true });
    } catch (error) {
      console.error('Meet leave error:', error);
      if (callBack) callBack({ isOk: false, message: "Leave error" });
    }
  });
});
