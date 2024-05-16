const {createServer} = require("http")
const express = require('express')
const cors = require('cors')
const app = express()

const {Server} = require('socket.io')
const allowedOrigins = ['http://localhost:3000', 'https://your-frontend-domain.com'];

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
        origin: 'http://localhost:3000', 
        methods: ["GET", "POST"]
    }
})
let broadcasters = {};
let rooms = []
let broadcasterViewer = {}
io.on('connection',(socket) => {
    // console.log(socket.id)
    socket.on('message',(message , room) => {
        io.to(room).emit('receive-message',message)
    })
    socket.on('streamer-message' , (message,room) => {
        io.to(room).emit('receive-message',message)
    })
    socket.on('join-stream',(room , viewerId) => {
            socket.join(room)
            socket.to(room).emit('joined', viewerId)
    })
    socket.on('create-stream',(streamInfo) => {
        // console.log(streamInfo)
        for(let i = 0 ; i < rooms.length ; i ++) {
            if(rooms[i].id === streamInfo.id) return ;
        }
        rooms.push({id: streamInfo.id,name: streamInfo.name,caption: streamInfo.caption})
        io.emit('created-stream',rooms)
        console.log(streamInfo.id,'asdasd132')
        broadcasterViewer[streamInfo.id] = []
        console.log(broadcasterViewer)
        
    })

    io.emit('created-stream',rooms)


    socket.on("register as broadcaster",  (room) => {
        // console.log("register as broadcaster for room", room);
        broadcasters[room] = socket.id;
        // console.log(broadcasters,'this is broadcasters')
        socket.join(room);
        const numberOfViewers = io.sockets.adapter.rooms.get(room)?.size || 0;
        socket.to(room).emit('viewers', numberOfViewers - 1)
    });

    socket.on('register as viewer',(user) => {
        // console.log("register as viewer for room", user.v_id);
        socket.join(user.id)
        user.v_id = socket.id  
        socket.to(broadcasters[user.id]).emit('new viewer',user)
      
        // if(typeof broadcasterViewer[user.id] === array) {
        //     broadcasterViewer[user.id].push(socket.id)
        // }
        console.log(typeof broadcasterViewer[user.id]=== Array)
        broadcasterViewer[user.id].push(socket.id)
        console.log(typeof broadcasterViewer[user.id],'asdasd')
        console.log( broadcasterViewer[user.id].length)
        const numberOfViewers = io.sockets.adapter.rooms.get(user.id)?.size || 0;
        socket.to(user.id).emit('viewers', numberOfViewers - 1)
        // console.log(`Number of viewers in room ${user.id}: ${numberOfViewers}`);
    })
    socket.on('candidate',(id,event) => {
        socket.to(id).emit("candidate", socket.id, event);
    })
    socket.on('offer',(id,event) => {
        event.broadcaster.id = socket.id
        socket.to(id).emit('offer',event.broadcaster , event.sdp)
    })
    socket.on('answer',(event) => {
        socket.to(broadcasters[event.room]).emit('answer',socket.id,event.sdp)
    })

    socket.on('disconnect',() => {
        let streamRoom;
        for(let i = 0 ; i < rooms.length ; i ++) {
            if(broadcasterViewer[rooms[i].id].includes(socket.id)) {
                console.log(rooms[i].id, 'this is the id')
                streamRoom = rooms[i].id
            }
        }
        rooms = rooms.filter(room => room.id !== streamRoom)
        socket.leave(streamRoom)
        socket.to(streamRoom).emit('disconnected','one disconnected')
        // broadcasterViewer[user.id].push(socket.id)
        const numberOfViewers = io.sockets.adapter.rooms.get(streamRoom)?.size || 0;
        socket.to(streamRoom).emit('viewers', numberOfViewers - 1)
        socket.to(streamRoom).emit('reconnect')
    })
    
})

httpServer.listen(4000 , () => {
    console.log("running port 3000")
})