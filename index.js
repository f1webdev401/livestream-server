const {createServer} = require("http")
const express = require('express')
const cors = require('cors')
const app = express()

const {Server} = require('socket.io')
const allowedOrigins = ['http://localhost:3000', 'https://f1webdev.tech'];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:3000','https://f1webdev.tech'], 
        methods: ["GET", "POST"]
    }
})
let broadcasters = {};
let rooms = []  
let broadcasterViewer = {}
let broadcasterId = {}
let chatDatabase = {}
io.on('connection',(socket) => {
    socket.on('message',(message , room , name, image) => {
        if(chatDatabase[room]) {
            chatDatabase[room].push({user: name , message:message,image:image})
        }
        io.to(room).emit('receive-message',chatDatabase[room])
    })
    socket.on('streamer-message' ,(message,room,name,image) => {
        if(chatDatabase[room]) {
            chatDatabase[room].push({user: name , message: message,image:image})
        }
        io.to(room).emit('receive-message',chatDatabase[room])
    })
    socket.on('join-stream',(room , viewerId) => {
            socket.join(room)
            socket.to(room).emit('joined', viewerId)
    })
    socket.on('create-stream',(streamInfo) => {
        for(let i = 0 ; i < rooms.length ; i ++) {
            if(rooms[i].id === streamInfo.id) return ;
        }
        rooms.push({id: streamInfo.id,name: streamInfo.name,caption: streamInfo.caption , imagestream: streamInfo.streamImgThumbnail})
        io.emit('created-stream',rooms)
        broadcasterViewer[streamInfo.id] = ['']
        
    })

    io.emit('created-stream',rooms)


    socket.on("register as broadcaster",  (room) => {
        broadcasters[room] = socket.id;
        socket.join(room);
        broadcasterId[room] = broadcasters[room]

        chatDatabase[room] = []
        const numberOfViewers = io.sockets.adapter.rooms.get(room)?.size || 0;
        io.to(room).emit('viewers', numberOfViewers - 1)
        io.to(room).emit('receive-message',chatDatabase[room])

    });

    socket.on('register as viewer',(user) => {
        if(!broadcasterViewer[user.id]) return ;
        socket.join(user.id)
        user.v_id = socket.id  
        socket.to(broadcasters[user.id]).emit('new viewer',user)
        broadcasterViewer[user.id].push(socket.id)
        const numberOfViewers = io.sockets.adapter.rooms.get(user.id)?.size || 0;
        io.to(user.id).emit('viewers', numberOfViewers - 1)
        io.to(user.id).emit('receive-message',chatDatabase[user.id])
        
    })
    socket.on('candidate',(id,event) => {
        socket.to(id).emit("candidate", socket.id, event);
    })
    socket.on('offer',(id,event) => {
        event.broadcaster.id = broadcasters[event.broadcaster.room]
        socket.to(id).emit('offer',event.broadcaster , event.sdp)
    })
    socket.on('answer',(event) => {
        socket.to(broadcasters[event.room]).emit('answer',socket.id,event.sdp)
    })

    socket.on('disconnect',() => {
        let streamRoom;
        for(let i = 0 ; i < rooms.length ; i ++) {
            if(broadcasterViewer[rooms[i].id].includes(socket.id)) {
                streamRoom = rooms[i].id
                if(broadcasterViewer[streamRoom].length == 2) {
                    broadcasterViewer[streamRoom] = ['']
                }
                if(broadcasterViewer[streamRoom].length > 2) {
                    let newBroadcasterViewer = broadcasterViewer[streamRoom].filter(id => id !== socket.id)
                    broadcasterViewer[streamRoom] = newBroadcasterViewer
                }
            }
            
        }
        let broadcasterIds = Object.keys(broadcasterId)
        for(let i = 0 ; i < broadcasterIds.length ; i ++) {
        if(broadcasters[broadcasterIds[i]] === socket.id) {
            rooms = rooms.filter(room => room.id !== broadcasterIds[i])
            io.emit('created-stream',rooms)
        }
        }
        socket.leave(streamRoom)
        socket.to(streamRoom).emit('disconnected',socket.id)
        const numberOfViewers = io.sockets.adapter.rooms.get(streamRoom)?.size || 0;
        io.to(streamRoom).emit('viewers', numberOfViewers - 1)
        socket.to(streamRoom).emit('reconnect')
    })

    
})

httpServer.listen(4000 , () => {
    console.log("running port 3000")
})