// server.js
require("dotenv").config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = "communityAppDb";

// Middleware to parse JSON request bodies
app.use(express.json());
// Enable CORS for all routes
app.use(cors());
// Serve static files
app.use(express.static(path.join(__dirname, 'public')));


let db; // Store the database connection
let participantMap = [];

// Connect to MongoDB
async function connectToMongo() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DATABASE_NAME);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

connectToMongo();

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('A user connected: ', socket.id);

  //Join room
  socket.on('joinRoom', (data)=>{
    socket.join(data.roomName);
      console.log(`User ${data.userName} joined ${data.roomName} on socket id ${socket.id}`);
       participantMap.push({socketId: socket.id, userName: data.userName});
      // Update user status to online
      updateParticipantStatus(data.userName, data.roomName, true);

      // Broadcast user join
      socket.to(data.roomName).emit('userJoined', data.userName)
       sendRoomParticipants(data.roomName);
  });

  socket.on('sendMessage', async (message, ack)=>{
    try{
         const newMessage = {
            userName: message.userName,
            roomName: message.roomName,
            text: message.text,
            timestamp: new Date(),
             read: false
         }
      const result = await db.collection('messages').insertOne(newMessage);
        if(result.insertedId){
            ack({status: 'ok'})
               io.to(message.roomName).emit('message', {...newMessage, _id: result.insertedId});
                console.log("message inserted", newMessage)
        } else{
             ack({status: 'error'})
        }
    }catch(e){
        console.error('Error sending message', e)
        ack({status: 'error'})
    }
  });
    socket.on('markMessageAsRead', async (data)=>{
        try{
            const result = await db.collection('messages').updateOne(
                { _id: new ObjectId(data.messageId) },
                { $set: { read: true } }
            );
           if(result.modifiedCount >0){
               io.to(data.roomName).emit('messageRead', data.messageId)
              console.log('Message updated', data.messageId)
           }
        }catch(e){
            console.error('Error marking message as read', e);
        }

    })
  socket.on('disconnect', ()=>{
        console.log('User Disconnected', socket.id);
         const disconnectedUser = participantMap.find(p => p.socketId === socket.id)
          if(disconnectedUser){
                Object.keys(socket.rooms).filter(r => r !== socket.id).forEach(roomName=>{
                // Update user status to offline
                  updateParticipantStatus(disconnectedUser.userName, roomName, false);
                  sendRoomParticipants(roomName);
                  })
            }
       participantMap = participantMap.filter(p => p.socketId !== socket.id);

  })
});

// Function to get username based on socket
function getUserNameFromSocket(socketId){
  let userName = null;
    io.sockets.sockets.forEach(socket=>{
          if(socket.id === socketId){
              Object.keys(socket.rooms).filter(r => r !== socketId).forEach(roomName=>{
               const user = participantMap.find(p=>p.socketId === socketId);
                    if(user){
                       userName = user.userName;
                         return;
                    }
               })

          }
    })
     return userName;
}


//API endpoints
//Serve the index.html file on root route
app.get('/', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/screen', (req, res)=>{
    res.sendFile(path.join(__dirname, 'public', 'screen.html'));
})
// Get all Rooms
app.get('/rooms', async (req, res)=>{
     if(!db){
        return res.status(500).json({error: "Database connection error!"});
    }
  try{
      const rooms = await db.collection('rooms').find({}).toArray();
      res.json(rooms);
  }catch(e){
      console.error("error get rooms", e)
      res.status(500).json({error: "error while getting rooms"})
  }
});
// Create a new room
app.post('/rooms', async (req, res) => {
    if(!db){
        return res.status(500).json({error: "Database connection error!"});
    }
    const {roomName, createdBy, bio} = req.body;
    if(!roomName || !createdBy || !bio){
      return res.status(400).json({ error: 'Missing data for room creation' });
    }
    try {
      const newRoom = {
        roomName: roomName,
        createdBy: createdBy,
        createdAt: new Date(),
        bio: bio
      }
        const result = await db.collection('rooms').insertOne(newRoom);
         if(result.insertedId){
              createParticipant(createdBy, roomName, true);
           return  res.status(201).json({ message: 'Room created successfully', room: {...newRoom, _id: result.insertedId}});
         }
        return res.status(500).json({ error: 'Error while creating room' });
    } catch (error) {
      console.error('Error creating room:', error);
       return res.status(500).json({ error: 'Error while creating room' });
    }
  });

// Get messages for a room
app.get('/messages/:roomName', async (req, res)=>{
     if(!db){
         return res.status(500).json({error: "Database connection error!"});
    }
   const {roomName} = req.params;
    try{
        const messages = await db.collection('messages').find({roomName: roomName}).toArray();
        res.json(messages)
    }catch(e){
        console.error('Error getting messages for room', roomName, e);
        return res.status(500).json({ error: 'Error while getting messages' });
    }
});

// Create a new participant
async function createParticipant(userName, roomName, online){
     if(!db){
          console.error("Database connection error!")
         return;
    }
    try{
        const existingParticipant = await db.collection('participants').findOne({userName: userName, roomName: roomName});
        if(!existingParticipant){
              await db.collection('participants').insertOne({userName: userName, roomName: roomName, online: online});
               console.log('Participant created', userName, roomName)
           }
    }catch(e){
        console.error('Error creating participant', userName, roomName, online, e);
    }
}
// update participant status
async function updateParticipantStatus(userName, roomName, online){
   if(!db){
         console.error("Database connection error!")
         return;
    }
  try{
        const result = await db.collection('participants').updateOne(
            {userName: userName, roomName: roomName},
            {$set: { online: online }}
        )
       if(result.modifiedCount >0){
            console.log('Participant updated', userName, roomName, online);
       }
  }catch(e){
      console.error("Error while updating participant status", userName, roomName, online, e);
  }
}

// get the participants in the room
async function sendRoomParticipants(roomName){
    if(!db){
        console.error("Database connection error!")
         return;
    }
   try{
       const participants = await db.collection('participants').find({roomName: roomName}).toArray();
        io.to(roomName).emit('participants', participants);
        console.log("participants sent", roomName);
   }catch(e){
       console.error("error while getting participants", roomName, e);
   }
}

app.get('/participants/:roomName', async (req, res)=>{
    if(!db){
         return res.status(500).json({error: "Database connection error!"});
    }
   const {roomName} = req.params;
    try{
          const participants = await db.collection('participants').find({roomName: roomName}).toArray();
        res.json(participants);
    }catch(e){
         console.error('Error getting participants', roomName, e);
         return res.status(500).json({ error: 'Error while getting participants' });
    }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});