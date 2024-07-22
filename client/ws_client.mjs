import Html5WebSocket from "html5-websocket";
import ReconnectingWebSocket from "reconnecting-websocket";
import { v4 as uuidv4 } from "uuid";
import fs from 'fs';

class ws_client {

    // Default constructor
    constructor(ws_host, ws_port, handlers, sslCaPath) {
        this.ws_host = ws_host;
        this.ws_port = ws_port;
        this.handlers = handlers;
        this.debugMode = false;
        this.listMode = false;

        // Load the CA certificate
        const ca = fs.readFileSync(sslCaPath);

        const options = { 
            WebSocket: Html5WebSocket,
            tlsOptions: {
                ca: [ selfSignedRootCaPemCrtBuffer ],
                rejectUnauthorized: false
            }
        };
        
        this.rws = new ReconnectingWebSocket("wss://" + ws_host + ":" + ws_port, undefined, options);
        this.rws.timeout = 100;
        this.refreshID = uuidv4();
        this.clientID = {
            id: uuidv4(),
            refreshID: this.refreshID,
            host: ws_host,
            port: ws_port,
        };
        this.defaultHandlers = {
            "server_accepted_connect": (m) => {
                if (m.params.sendToUUID == this.clientID.id) {
                    this.refreshID = m.params.firstRefreshID;
                    if (this.debugMode == true) {
                        console.log("[Client] Connection to WebSocket Server was opened.");
                    }
                    if (this.listMode == true) {
                        console.log("-----------------------------------");
                        console.log("----------| Server Info |----------");
                        console.log("id:", m.params.id);
                        console.log("refreshID:", m.params.firstRefreshID);
                        console.log("port:", m.params.port);
                        console.log("current clients:", m.params.numClients);
                        console.log("-----------------------------------");
                        console.log("-----------------------------------");
                    }
                    this.send_message("client_return_probe", { refreshID: m.params.firstRefreshID, id: this.clientID.id, serverID: m.params.id });
                }
            },
            "server_probe": (m) => {
                if (this.ws_port == m.params.port) {
                    this.send_message("client_return_probe", { refreshID: m.params.refreshID, id: this.clientID.id, serverID: m.params.id });
                }
            }
        };

        // On connection opened
        this.rws.addEventListener("open", () => {
            console.log("[Client] WebSocket connection opened");
            this.send_message("client_request_connect", this.clientID);
        });

        // On message received from server
        // The data will come in as a JSON object file converted into a string. Parse that data into a JSON object. Then, send the object to be handled. Otherwise, alert that the message was not correctly formatted.
        this.rws.addEventListener("message", (e) => {
            try {
                let m = JSON.parse(e.data);
                this.handle_message(m);
            } catch (err) {
                if (this.debugMode == true) {
                    console.log("[Client] Message is not parseable to JSON.");
                }
            }
        });

        // On server connection closed
        // Try to reconnect based on the timeout settings.
        this.rws.addEventListener("close", () => {
            console.log("[Client] Connection closed. Reconnecting...");
        });

        // On server connection down (not temporary)
        // Alert that the server is down completely. No reconnecting.
        this.rws.addEventListener("error", (err) => {
            console.error("[Client] WebSocket error:", err);
        });
    }

    // Handle incoming messages
    // Extract the METHOD element from the JSON object message. If method is defined and exists in the HANDLERS object, then run the defined function from HANDLERS. Otherwise, alert that the method is either undefined or is not in the HANDLERS object.
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
                if (this.debugMode == true) {
                    console.log("[Client] No handler defined for method " + method + ".");
                }
            }
        }
    }

    // Send JSON object to server
    // Given the desired method and parameters, package into a JSON object, stringify it, and send it to the server. 
    send_message = (method, parameters) => {
        let newMessage = JSON.stringify({
            method: method,
            params: parameters
        });

        this.rws.send(newMessage);
        if (this.debugMode == true) {
            console.log("[Client] Message sent to server: \n\t", newMessage);
        }
    }

    // Determines if client operates in debug mode
    // If TRUE => client messages will print to the client console.
    // If FALSE => client messages will not print to the console. The console will be blank unless manipulated by the user.
    set_debug_mode = (debugMode) => {
        this.debugMode = debugMode;
    }

    // Determines if client operates in list mode
    // If TRUE => client's server connection will be printed upon client connected.
    // If FALSE => client's server connection will never be printed.
    set_list_mode = (listMode) => {
        this.listMode = listMode;
    }
}

export default ws_client;
