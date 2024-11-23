const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
mongoose.connect("mongodb+srv://Rohith:Rohith_14_IM_@cluster0.a19xa.mongodb.net/", {
  
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});
const Message=require('./models/Message');
const users = {}; 
app.use(cors());
app.use(express.json());

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("register", (username) => {
    users[username] = socket.id;
    console.log(`${username} registered with socket ID ${socket.id}`);
    io.emit("online_users", Object.keys(users)); 
  });

  socket.on("private_message", async ({ sender, recipient, message }) => {
    const newMessage = new Message({ sender, recipient, content: message });
    await newMessage.save();

    const recipientSocketId = users[recipient];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("private_message", { sender, message });
    } else {
      socket.emit("error", "Recipient is not online.");
    }
  });
  socket.on("get_recent_chats", async (username) => {
    try {
      const recentChats = await Message.aggregate([
        {
          $match: {
            $or: [{ sender: username }, { recipient: username }],
          },
        },
        {
          $group: {
            _id: {
              chatPartner: {
                $cond: [
                  { $eq: ["$sender", username] },
                  "$recipient",
                  "$sender",
                ],
              },
            },
            lastMessage: { $last: "$content" },
            lastTimestamp: { $last: "$timestamp" },
          },
        },
        { $sort: { lastTimestamp: -1 } }, 
      ]);
  
     
      const recentChatsWithStatus = recentChats.map((chat) => ({
        ...chat,
        isOnline: !!users[chat._id.chatPartner],
      }));
  
      socket.emit("recent_chats", recentChatsWithStatus);
    } catch (err) {
      console.error("Error fetching recent chats:", err);
      socket.emit("error", "Failed to fetch recent chats.");
    }
  });
  
  socket.on("get_chat_history", async ({ user1, user2 }) => {
    try {
      const history = await Message.find({
        $or: [
          { sender: user1, recipient: user2 },
          { sender: user2, recipient: user1 },
        ],
      }).sort("timestamp");

      socket.emit("chat_history", history);
    } catch (err) {
      console.error("Error fetching chat history:", err);
      socket.emit("error", "Failed to fetch chat history.");
    }
  });
  socket.on("disconnect", () => {
    for (const [username, id] of Object.entries(users)) {
      if (id === socket.id) {
        delete users[username];
        io.emit("online_users", Object.keys(users)); 
        console.log(`${username} disconnected`);
        break;
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
