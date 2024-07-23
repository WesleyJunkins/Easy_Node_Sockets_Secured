import express from "express";
import WebSocket, { WebSocketServer as SocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import fs from 'fs';
import https from 'https';

// WebSocket Server Class
class ws_server {

    // Default constructor
    constructor(server_port, handlers, sslKeyPath, sslCertPath, sslCaPath, passphrase=null) {
        this.server_port = server_port;
        this.handlers = handlers;

        const options = {
            key: fs.readFileSync(sslKeyPath),
            cert: fs.readFileSync(sslCertPath),
            ca: fs.readFileSync(sslCaPath),
            requestCert: false,
            rejectUnauthorized: false
        };

        if (passphrase) {
            options.passphrase = passphrase;
        }

        // Create an HTTPS server
        const app = express();
        const server = https.createServer(options, app);
        server.listen(this.server_port, () => {
            console.log(`[Server] HTTPS server listening on port ${this.server_port}`);
        });

        this.wss = new SocketServer({ server });
        this.broadcastable = false;
        this.debugMode = false;
        this.listMode = false;
        this.probeMode = false;
        this.probeInterval = 10000;
        if (this.debugMode === true) {
            console.log("[Server] Created a WebSocket server on port " + this.server_port + ".");
        }
        this.start_server(handlers);
        this.refreshID = uuidv4();
        this.clientList = [];
        this.serverID = {
            id: uuidv4(),
            port: server_port,
            numClients: 0
        };
        this.defaultHandlers = {
            "client_request_connect": (m) => {
                this.clientList.push(m.params);
                if (this.debugMode === true) {
                    console.log("[Server] A client connected.");
                }
                if (this.listMode === true) {
                    console.log("-----------------------------------");
                    console.log("----------| Client List |----------");
                    console.log(this.clientList);
                    console.log("-----------------------------------");
                    console.log("-----------------------------------");
                }

                // Accept the connection
                this.serverID.numClients++;
                this.broadcast_message("server_accepted_connect", { id: this.serverID.id, port: this.serverID.port, numClients: this.serverID.numClients, sendToUUID: m.params.id, firstRefreshID: this.refreshID });
            },
            "client_return_probe": (m) => {
                const updateClientIndex = this.clientList.findIndex(ele => ele.id == String((m.params.id).trim()));
                this.clientList[updateClientIndex].refreshID = this.refreshID;
            }
        };
    }

    // Server setup
    start_server = (handlers) => {
        this.handlers = handlers;

        // On client connected
        this.wss.on("connection", (ws) => {
            console.log("[Server] Client connected");

            // How often to probe clients to clean client list
            if (this.probeMode === true) {
                setInterval(() => {
                    this.probe_clients();
                }, this.probeInterval);
            }

            // On client connection closed
            ws.on("close", () => {
                if (this.debugMode === true) {
                    console.log("[Server] A client disconnected.");
                }
            });

            // On message received from client
            ws.on("message", (message) => {
                try {
                    let m = JSON.parse(message);
                    this.handle_message(m);
                } catch (err) {
                    if (this.debugMode === true) {
                        console.log(err);
                        console.log("[Server] Message is not parseable to JSON.");
                    }
                }

                if (this.broadcastable == true) {
                    this.wss.clients.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(message);
                        }
                    });
                }
            });
        });
    }

    // Handle incoming messages
    handle_message = (m) => {
        if (m.method == undefined) {
            return;
        }

        let method = m.method;

        if (method) {
            if (this.handlers[method]) {
                let handler = this.handlers[method];
                handler(m);
            } else if (this.defaultHandlers[method]) {
                let handler = this.defaultHandlers[method];
                handler(m);
            } else {
                if (this.debugMode === true) {
                    console.log("[Server] No handler defined for method " + method + ".");
                }
            }
        }
    }

    // Broadcast JSON object to all clients
    broadcast_message = (method, parameters) => {
        let newMessage = JSON.stringify({
            method: method,
            params: parameters
        });

        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(newMessage);
                if (this.debugMode === true) {
                    console.log("[Server] Message broadcast to clients: \n\t", newMessage);
                }
            } else {
                if (this.debugMode === true) {
                    console.log("[Server] Client did not receive message broadcast. Client readyState = CLOSED.");
                }
            }
        });
    }

    // Determines if broadcastable
    set_broadcastable = (broadcastable) => {
        this.broadcastable = broadcastable;
    }

    // Determines if server operates in debug mode
    set_debug_mode = (debugMode) => {
        this.debugMode = debugMode;
    }

    // Determines if server operates in list mode
    set_list_mode = (listMode) => {
        this.listMode = listMode;
    }

    // Determines if server operates in probe mode
    set_probe_mode(probeMode, probeInterval) {
        this.probeMode = probeMode;
        if (probeMode === true) {
            this.probeInterval = probeInterval;
        }
    }

    // Probe active clients
    probe_clients = () => {
        let somethingWasRemoved = false;
        for (let i = 0; i < this.clientList.length; i++) {
            if (this.clientList[i].refreshID != this.refreshID) {
                this.clientList[i].warningNumber++;
                console.log("Client ID:", this.clientList[i].id, "has refresh ID:", this.clientList[i].refreshID, "which does not match current refresh ID: ", this.refreshID)
                this.clientList.splice(i, 1);
                this.serverID.numClients--;
                somethingWasRemoved = true;
            }
        }
        this.refreshID = uuidv4();
        this.broadcast_message("server_probe", { refreshID: this.refreshID, id: this.serverID.id, port: this.serverID.port });
        if (somethingWasRemoved === true) {
            if (this.listMode === true) {
                console.log("-----------------------------------");
                console.log("----------| Client List |----------");
                console.log(this.clientList);
                console.log("-----------------------------------");
                console.log("-----------------------------------");
            }
        }
    }
};

export default ws_server;
