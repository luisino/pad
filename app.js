var host = 'localhost';
//var host = '192.168.1.100';
//var host = '172.19.10.101';
var port = '8080'; 

var express = require('express')
  , app = express()
  , http = require('http')
  , server = http.createServer(app).listen(port,host)
  , io = require('socket.io').listen(server);
  //, fs = require('fs');

var nodemailer = require("nodemailer");


/*
var sqlite3 = require('sqlite3').verbose();

var usersDB = new sqlite3.Database("users.db");

  usersDB.serialize(function() {
  usersDB.run("CREATE TABLE if not exists users (info TEXT)");

  var stmt = usersDB.prepare("INSERT INTO users VALUES (?)");
  for (var i = 0; i < 10; i++) {
      stmt.run("test database " + i);
  }
  stmt.finalize();

  usersDB.each("SELECT rowid AS id, info FROM users", function(err, row) {
      console.log(row.id + ": " + row.info);
  });
});

usersDB.close();
*/

var actualRoomName = '';
var actualToken = '';

function sendEmail( email, token ) {
	var transporter = nodemailer.createTransport({
	    service: 'gmail',
	    auth: {
	        user: 'pad.teamq@gmail.com',
	        pass: 'padteamq2015'
	    }
	});
	transporter.sendMail({
	    from: 'noreply@expresschat.com',
	    to: email,
	    subject: 'Join chat at '+actualRoomName,
	    text: 'Please go to this url to join chat http://'+host+':'+port+'/'+token
	});
	console.log( 'sended email to ' + email + ' with token ' + token );
}

function getNewToken() {
	var token_ = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
	return token_;
}

// token return roomname
var tokens = {
	"aaa" : "pad",
	"bbb" : "room2",
	"ccc" : "room3"
};

app.use(express.static(__dirname + '/public'));

//server.listen(8000);

console.log("Server listening on "+host+":8080 ...");

// routing

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/:token', function (req, res) {
	var token = req.param('token');
  	if ( tokens[token] ) {
  		actualRoomName = tokens[token];
  		actualToken = token;
  		res.sendFile(__dirname + '/room.html' );
  		console.log('detectado token registrado: ' + token);
  	}
  	else {
  		//res.sendFile( __dirname + '/index.html' );
  		res.send('Peticion illegal');
  		console.log( 'token no registrado: ' + token );
	}
  	
});

// usernames which are currently connected to the chat
var usernames = {};

// rooms which are currently available in chat
var rooms = ['room1','room2','room3'];

io.sockets.on('connection', function (socket) {

	socket.room = actualRoomName;

    socket.on('userimage', function (msg) {
      //console.log(msg);
      io.sockets.in( socket.room ).emit( 'userimage', socket.username, msg );
      console.log('sended image to '+socket.room);
    });


    socket.on('avatarimg', function (msg) {
      //console.log(msg);
      socket.emit( 'avatarimg', socket.username, msg );
      console.log('sended avatar image to '+socket.username);
    });


	socket.on( 'checkToken', function( token ) {
		if ( tokens[token] ) {
			socket.emit('setToken', token );
		}
		else {
			socket.emit('setToken', '-1' );
		}
	});

	socket.on( 'checkRoomname', function( roomname ) {
		if ( rooms[roomname] ) {
			socket.emit('setRoomname', '1' );
		}
		else {
			socket.emit('setRoomname', '-1' );
		}
	});

	// creare una funcion joinChat
	socket.on( 'createChat', function( userData ) {
		actualRoomName = userData.roomname;
		//var username = userData.username;
		var email = userData.email;
		// create token
		var token = getNewToken();
		// pensar algo para que no se generen dos tokens iguales.
		if ( tokens[token] ) {
			token = getNewToken(); // de momento esto, hacer mejor comprobacion
		}
		tokens[token] = actualRoomName;
		link = 'http://'+host+':8080/'+token;
		socket.emit('updateLink', link );
		sendEmail( email, token );
		socket.emit('setToken',token);
	});

	// creare una funcion joinChat
	socket.on( 'sendEmail', function( email ) {
		var token = actualToken;
		link = 'http://'+host+':8080/'+token;
		sendEmail( email, token );
		socket.emit('sendedEmail',email);
	});
	
	
	// when the client emits 'addroom', this listens and executes
	socket.on('addroom', function(roomname){
		// store the room name in the socket session for this client
		socket.room = roomname;
		// send client to roomname
		socket.join( roomname );
		// echo to client they've connected
		socket.emit( 'updatechat', 'SERVER', 'you have connected to ' + roomname );
		// echo to roomname that a person has connected to their room
		socket.broadcast.to( roomname ).emit('updatechat', 'SERVER', username + ' has connected to this room');
		socket.emit( 'updateroom', roomname );

	});
	
	// when the client emits 'adduser', this listens and executes
	socket.on('adduser', function( username ){
		var roomname = actualRoomName;
		// store the username in the socket session for this client
		socket.username = username;
		// store the room name in the socket session for this client
		socket.room = roomname;
		rooms.push( roomname );
		// add the client's username to the global list
		usernames[username] = username;
		// send client to room 1
		socket.join( roomname );
		// echo to client they've connected
		socket.emit( 'updatechat', 'SERVER', 'you have connected to ' + roomname );
		// echo to room 1 that a person has connected to their room
		socket.broadcast.to( roomname ).emit( 'updatechat', 'SERVER', username + ' has connected to this room' );
		//socket.emit('updaterooms', rooms, roomname );
		//socket.emit('updateusers', JSON.stringify(usernames));
		//socket.emit( 'updateroom', roomname );

	});
	
	// when the client emits 'sendchat', this listens and executes
	socket.on('sendchat', function (data) {
		// we tell the client to execute 'updatechat' with 2 parameters
		//io.sockets.in(socket.room).emit('updatechat', socket.username, data);

		io.sockets.in( socket.room ).emit( 'updatechat', socket.username, data );
		
	});
	
	socket.on('switchRoom', function(newroom){
		socket.leave(socket.room);
		socket.join(newroom);
		socket.emit('updatechat', 'SERVER', 'you have connected to '+ newroom);
		// sent message to OLD room
		socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left this room');
		// update socket session room title
		socket.room = newroom;
		socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username+' has joined this room');
		//socket.emit('updaterooms', rooms, newroom);
		//socket.emit( 'updateroom', roomname );
	});
	

	// when the user disconnects.. perform this
	socket.on('disconnect', function(){
		// clear localStorge
		socket.emit('clearLocalStorage',socket.username);
		console.log( 'deleted user: ' + socket.username );
		// remove the username from global usernames list
		delete usernames[socket.username];
		// update list of users in chat, client-side
		socket.broadcast.to(socket.room).emit('updateusers', usernames);
		// echo globally that this client has left
		socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username + ' has disconnected');
		socket.leave(socket.room);

	});

	setInterval(function(){ 
		//socket.emit( 'updateroom', actualRoomName );
		socket.broadcast.to(socket.room).emit('updateusers', JSON.stringify(usernames));
		
	}, 5000);
});
