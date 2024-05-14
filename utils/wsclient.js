const WebSocket = require('ws');

const socket = new WebSocket('ws://localhost:8546');

socket.onopen = function(event) {
  // Handle connection open
  console.log("Open");
};

socket.onmessage = function(event) {
  // Handle received message
  console.log("Message");
  sendMessage("Hello");
};

socket.onclose = function(event) {
  // Handle connection close
  console.log("Close");
};

function sendMessage(message) {
  socket.send(message);
}