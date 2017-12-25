const express = require("express");
const app = express();
var bodyParser = require("body-parser");
var path = require("path");
var crypto = require("crypto");
var http = require('http').Server(app);
var io = require('socket.io')(http);
var TAFFY = require('taffy');

var order_db = TAFFY([]);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname + "/html/index.html"));
});

app.get("/check-in", function(req, res) {
  res.sendFile(path.join(__dirname + "/html/check-in.html"));
});

app.get("/order", function(req, res) {
  res.sendFile(path.join(__dirname + "/html/order.html"));
});

app.post("/submit-check-in", function(req, res) {
  res.redirect("/show-orders?dining_location=" + encodeURIComponent(req.body.dining_location) + "&name=" + encodeURIComponent(req.body.name));
});

app.post("/submit-order", function(req, res) {
  order = {
    dining_location: req.body.dining_location,
    name: req.body.name,
    pickup_location: req.body.pickup_location,
    payment: req.body.payment,
    order_id: crypto.createHash('md5').update("" + Date.now()).digest("hex") + Math.floor(Math.random() * 1000000000),
    chatting: false
  };

  order_db.insert(order);

  res.redirect("/chat-with-deliverer?roomID=" + order.order_id + "&userRole=orderer&name=" + encodeURIComponent(req.body.name));
});

app.get("/chat-with-deliverer", function(req, res) {
  res.sendFile(__dirname + "/html/chat-server.html");
});

app.get("/chat-with-orderer", function(req, res) {
  order_db({order_id: req.body.order_id}).update({chatting: true});
  res.sendFile(__dirname + "/html/chat-server.html");
});

app.get("/show-orders", function(req, res) {
  res.sendFile(path.join(__dirname + "/html/show-orders.html"));
});

app.get("/ajax-get-orders", function(req, res) {
  res.setHeader("Content-Type", "application/json");

  orders = order_db({ dining_location: req.query.dining_location, chatting: false }).get();

  res.send(JSON.stringify(orders));
  res.end();
});

io.on('connection', function(socket){
  socket.on('disconnect', function(){
    console.log('user disconnected: ' + this.room + this.userRole);
    order = order_db({ order_id: this.room });
    if (this.userRole == "orderer")
      order.remove();
    else
      order.update({ chatting: false });

    io.sockets.in(this.room).emit('user_disconnected', "true");
  });
});

io.on('connection', function(socket) {
  socket.on('chat_message', function(data) {
    io.sockets.in(data.roomID).emit('message', { message: data.message, from: data.from });
  });

  socket.on('deliverer_name', function(data) {
  	io.sockets.in(data.roomID).emit('deliverer_name', data.name);
  });

  socket.on('orderer_name', function(data) {
    io.sockets.in(data.roomID).emit('orderer_name', data.name)
  });
});

io.sockets.on('connection', function(socket) {
    // once a client has connected, we expect to get a ping from them saying what room they want to join
    socket.on('room', function(data) {

      if (data.userRole == "deliverer") 
        order_db({order_id: data.room}).update({chatting: true});

      socket.userRole = data.userRole;
    	socket.room = data.room;
      socket.join(data.room);
    });
});

http.listen(process.env.PORT || 5000, function(){
  console.log('listening on: ' + (process.env.PORT || 5000));
});


