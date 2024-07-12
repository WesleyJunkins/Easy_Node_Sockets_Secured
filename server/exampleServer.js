import ws_server from "./ws_server.mjs";

// TESTING SERVER CLASS

// Step 1: define the handlers for your server.
//         I.e. When an object is sent with a method name, create a function to be run when that message is received.
let handlers = {
    "set-background-color": function (m) {
        console.log("[Server] Set background color to " + m.params.color + ".");
    },
    "say": function (m) {
        console.log("[Server] " + m.params.text);
    }
}

// Security Step: define the path to your SSL key, certificate, and CA certificate so they can be loaded.
const sslKeyPath = './sslCerts/server-key.pem';
const sslCertPath = './sslCerts/server-cert.pem';
const sslCaPath = './sslCACerts/ca-cert.pem';
const sslKeyPassphrase = 'htil2017';

// Step 2: create a new server.
//         Include the value of the port on which you want to listen, as well as the handlers object you just created.
//         Beyond this, the server is running.
const myNewServer = new ws_server(3000, handlers, sslKeyPath, sslCertPath, sslCaPath, sslKeyPassphrase);
myNewServer.set_list_mode(true);
myNewServer.set_debug_mode(true);
myNewServer.set_broadcastable(true);

// Step 3: write code to interact with client(s).
setInterval(function () {
    myNewServer.broadcast_message("say", { text: "This was broadcast from the server. The next one happens in 5secs." });
}, 5000);
