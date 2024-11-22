const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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

  socket.on("private_message", ({ sender, recipient, message }) => {
    const recipientSocketId = users[recipient];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("private_message", { sender, message });
    } else {
      socket.emit("error", "Recipient is not online.");
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
