// Need to decide on ES6 syntax or other
import process from 'node:process'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { multiaddr } from '@multiformats/multiaddr'
import { kadDHT } from '@libp2p/kad-dht'
import { yamux } from '@chainsafe/libp2p-yamux'
import { ping } from '@libp2p/ping' // remove this after done testing
import { bootstrap } from '@libp2p/bootstrap'
import {mdns} from '@libp2p/mdns';

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { generateKeyPair} from '@libp2p/crypto/keys'
import { peerIdFromKeys, peerIdFromString } from '@libp2p/peer-id'
import readline from 'readline';

// Setting up a websocket to exchange with the gui
import { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';


import geoip from 'geoip-lite';

const ip = '146.190.129.133';
const location = geoip.lookup(ip);
console.log(location);

// libp2p node logic
const test_node = await createLibp2p({
    // peerId: customPeerId,
    addresses: {
        // add a listen address (localhost) to accept TCP connections on a random port
        listen: ['/ip4/0.0.0.0/tcp/0']
    },
    transports: [
        tcp()
    ],
    streamMuxers: [
        yamux()
    ],
    connectionEncryption: [
        noise()
    ],
    peerDiscovery: [
        bootstrap({
            list: [
                // bootstrap node here is generated from dig command
                '/dnsaddr/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
            ]
        })
    ],
    services: {
        dht: kadDHT({
            kBucketSize: 20,
        }),
        ping: ping({
            protocolPrefix: 'ipfs',
        }),
    }
});

// const tonyMultiaddr = multiaddr('/ip4/172.25.87.26/tcp/63820/p2p/12D3KooWGNmUsoaUNuHENbbk4Yg7euUwbCi4H9RNgtPoYkkAWJFH');
// const tonyMultiaddr = multiaddr('/ip4/172.25.87.26/tcp/63820/p2p/12D3KooWGNmUsoaUNuHENbbk4Yg7euUwbCi4H9RNgtPoYkkAWJFH');
const discoveredPeers = new Map();

const test_node2 = await createLibp2p({
    addresses: {
        // add a listen address (localhost) to accept TCP connections on a random port
        listen: ['/ip4/0.0.0.0/tcp/0']
    },
    transports: [
        tcp()
    ],
    streamMuxers: [
        yamux()
    ],
    connectionEncryption: [
        noise()
    ],
    peerDiscovery: [
        mdns()
    ]
});

await test_node2.start();
console.log('Test Node 2 has started:', test_node2.peerId);
console.log("Actively searching for peers on the local network...");
// console.log("Multiaddr of Test Node 2:", getMultiaddrs(test_node2));

// const selectedPeerAddr = multiaddr('/ip4/146.190.129.133/tcp/36077/p2p/12D3KooWEfxnYQskJ6wjVts6pNdyFbw4uPcV6LtfEMdWpbEKkxYk')
// try {
//     console.log(`\nConnecting to ${selectedPeerAddr}...`);
//     await test_node2.dial(selectedPeerAddr);
//     console.log(`Connected to ${selectedPeerAddr}`);
// } catch (error) {
//     console.log(error)
//     console.error(`Failed to connect to ${selectedPeerAddr}`);
// }


// const testid = '12D3KooWGFvxLfn6kh2dwC9f23rAZ2QaECb87VDDez2AHqDyZgga';
// const peertestid = peerIdFromString(testid);

const ipAddresses = [];
let local_peer_node_info = {}
test_node2.addEventListener('peer:discovery', (evt) => {
    const peerId = evt.detail.id;
    const multiaddrs = evt.detail.multiaddrs;

    ipAddresses.length = 0;

    multiaddrs.forEach(ma => {
        const multiaddrString = ma.toString();
        const ipRegex = /\/ip4\/([^\s/]+)/;
        const match = multiaddrString.match(ipRegex);
        const ipAddress = match && match[1];

        if(ipAddress) {
            ipAddresses.push(ipAddress);
        }
    });

    let peerInfo = new Object();

    ipAddresses.forEach(ip => {
        const location = geoip.lookup(ip);
        peerInfo = createPeerInfo(location, peerId);
    })

    // console.log(evt.detail);
    // Get non 127... multiaddr and convert the object into a string for parsing
    const nonlocalMultaddr = evt.detail.multiaddrs.filter(addr => !addr.toString().startsWith('/ip4/127.0.0.')).toString();
    // console.log(nonlocalMultaddr);
    // Extract IP address
    const ipAddress = nonlocalMultaddr.split('/')[2];
    // Extract port number
    const portNumber = nonlocalMultaddr.split('/')[4];
    // console.log('IP address:', ipAddress);
    // console.log('Port number:', portNumber);

    local_peer_node_info = {ip_address: ipAddress, port : portNumber}

    const randomWord = generateRandomWord();
    discoveredPeers.set(randomWord, peerInfo);
    // console.log("Discovered Peers: ", discoveredPeers);
    console.log('\nDiscovered Peer with PeerId: ', peerId);
    // console.log("IP addresses for this event:", ipAddresses);
});

test_node2.addEventListener('peer:disconnect', (evt) => {
    const peerId = evt.detail;
    console.log(`\nPeer with ${peerId} disconnected`)
    const keyToRemove = getKeyByValue(discoveredPeers, peerId);
    if (keyToRemove !== null) {
        discoveredPeers.delete(keyToRemove);
    } else {
        console.log("PeerId not found in the map.");
    }
});

function getKeyByValue(map, value) {
    const peerIdToRemove = value.toString();
    for (let [key, val] of map.entries()) {
        let peerId = val.peerId;
        let peerIdString = peerId.toString();
        if (peerIdString === peerIdToRemove) {
            return key;
        }
    }
    return null; 
}

function createPeerInfo(location, peerId) {
    const locationInfo = location !== null ? {
        city: location.city,
        state: location.region,
        country: location.country,
        latitude: location.ll[0],
        longitude: location.ll[1]
    } : null;

    const peerInfo = {
        peerId: peerId,
        location: locationInfo
    };

    return peerInfo;
}

function findPeerInfoByPeerId(peerMap, peerId) {
    for (const [randomWord, info] of peerMap.entries()) {
        console.log(info.peerId)
        console.log(peerId)
        if (info.peerId === peerId) {
            console.log("ceck this: ")
            console.log(info)
            console.log(randomWord)
            return info;
        }
    }
    return null;
}
console.log("discover")
displayMenu(discoveredPeers, test_node2);

/**
 * TODO:
 * -transfer files
 * -conduct a wallet transfer
 */
function displayMenu(discoveredPeers, node) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    function displayOptions() {
        console.log("\nMenu Options:");
        console.log("1. List discovered peers");
        console.log("2. List known information on a peer");
        console.log("3. List connected peers");
        console.log("4. Retrieve a peers public key");
        console.log("5. Connect to GUI");
        console.log("6. Make a market transaction???");
        console.log("7. Connect to a public peer");
        console.log("8. Send Message");
        console.log("9. Exit");

        rl.question("\nEnter your choice: ", async (choice) => {
            switch (choice) {
                case '1':
                    console.log("Peers that are discovered:", discoveredPeers);
                    displayOptions();
                    break;
                case '2':
                    console.log("Peers available:");
                    discoveredPeers.forEach((peerInfo, randomWord) => {
                        console.log(`${randomWord}, ${peerInfo.peerId}`);
                    });
                    rl.question("\nEnter the 5-letter word of the peer you want to find information on: ", async (word) => {
                        const selectedPeerInfo = discoveredPeers.get(word);
                        const selectedPeerId = selectedPeerInfo.peerId;
                        if (selectedPeerId) {
                            try {
                                const peer = await node.peerStore.get(selectedPeerId)
                                console.log("Known information about this peer: ", peer)
                            } catch (error) {
                                console.error(`Failed to connect to ${selectedPeerId}`);
                            }
                        } else {
                            console.log("Invalid peer. Please try again");
                        }
                        displayOptions();
                    });
                    break;
                case '3':
                    console.log("Peers you are currently connected to:");
                    console.log(node.getPeers());
                    displayOptions();
                    break;
                case '4':
                    console.log("Peers available:");
                    discoveredPeers.forEach((peerInfo, randomWord) => {
                        console.log(`${randomWord}, ${peerInfo.peerId}`);
                    });
                    rl.question("\nEnter the 5-letter word of the peer you want: ", async (word) => {
                        const selectedPeerInfo = discoveredPeers.get(word);
                        const selectedPeerId = selectedPeerInfo.peerId;
                        if (selectedPeerId) {
                            try {
                                const publicKey = await node.getPublicKey(selectedPeerId);
                                console.log("Public Key of Peer: ", publicKey);
                            } catch (error) {
                                console.error(`Failed to retrieve information of public key on  ${selectedPeerId}`);
                            }
                        } else {
                            console.log("Invalid peer. Please try again");
                        }
                        displayOptions();
                    });
                    break;
                case '5':
                    const ws = new WebSocketServer({ port: 5174 }) // Server
                    // const ws = new WebSocket('ws://localhost:5174'); // Client

                    console.log("Now opening up websocket connection to GUI...")
                    // When a client connects to the WebSocket server
                    ws.on('connection', (ws) => {
                        console.log('Client connected');
                
                        // Handle requests from the GUI 
                        ws.on('message', (message) => {
                            console.log('Request: ', message.toString());
                            if (message.toString() === 'GET_DATA') {
                                console.log("received GET request")
                                // If the message is 'GET_DATA', send the peer node information to the client
                                console.log(discoveredPeers === local_peer_node_info.peerID)
                                const ipRegex = /\/ip4\/([^\s/]+)/;
                                const match = getMultiaddrs(test_node2)[1].match(ipRegex);
                                const ipAddress = match && match[1];

                                const portRegex = "//tcp/(\d+)/";
                                const match2 = getMultiaddrs(test_node2)[1].match(portRegex);
                                const portNumber = match2 && match2[1];
                                console.log("Port number:", portNumber);

                                // TODO: Update this peer id as needed
                                discoveredPeers
            
                                const peerInfo = findPeerInfoByPeerId(discoveredPeers, "12D3KooWSXZGdoTXPaXS7SzrA1oN1BoYLByn9KghndmC1aV2s7hZ"); 
                                console.log("location")
                                console.log(peerInfo)
                                console.log(peerInfo.location)
                                const peerNodeInfo = {
                                  // Example peer node information
                                  id: "12D3KooWSXZGdoTXPaXS7SzrA1oN1BoYLByn9KghndmC1aV2s7hZ", 
                                  address: "128.199.237.234",
                                  port: "96",
                                  location: peerInfo.location
                                };
                          
                                // Convert the peer node information to JSON and send it back to the client
                                // ws.send(JSON.stringify(peerNodeInfo));
                                // Send response with header type NODE_INFO
                                ws.send(JSON.stringify({ type: 'NODE_INFO', data: peerNodeInfo }));
                              }
                    
                            // if (parsedData.type === 'NODE_INFO') {
                        });
                        // Send a welcome message to the client
                        ws.send('Welcome to the WebSocket server!');
                    });
                    ws.on('error', (error) => {
                        console.error('WebSocket error:', error);
                    });
                    displayOptions();
                    break;
                case '6':
                    console.log("Make a market transaction");
                    break;
                case '7':
                    console.log("Connect to a public peer node:");
                    rl.question("\nEnter IP Address of public node you're connecting to: ", async (ipAddress) => {
                        rl.question("\nEnter Port number the node you're connecting to is listening on: ", async (portNumber) => {
                            rl.question("\nEnter the Peer ID: ", async (peerID) => {
                                let userInputMultiAddr = multiaddr(`/ip4/${ipAddress}/tcp/${portNumber}/p2p/${peerID}`);
                                console.log("Your multiaddress string is: ", userInputMultiAddr);
                                try {
                                    console.log(`\nConnecting to ${userInputMultiAddr}...`);
                                    await node.dial(userInputMultiAddr);
                                    console.log(`Connected to ${userInputMultiAddr}`);
                                    let peerInfo = new Object();
                                    const location = geoip.lookup(ipAddress);
                                    peerInfo = createPeerInfo(location, peerID);
                                    const randomWord = generateRandomWord();
                                    discoveredPeers.set(randomWord, peerInfo);
                                } catch (error) {
                                    console.error(`Failed to connect to ${userInputMultiAddr}`);
                                    console.log(error)
                                    console.error(`Please confirm you answered all of the questions correctly and that firewall rules have been adjusted for port ${portNumber}`);
                                }
                                displayOptions();
                            });
                        });
                    });
                    break;
                case '8':
                    console.log("Peers available:");
                    discoveredPeers.forEach((peerInfo, randomWord) => {
                        console.log(`${randomWord}, ${peerInfo.peerId}`);
                    });
                    rl.question("\nEnter the 5-letter word of the peer you want: ", async (word) => {
                        const selectedPeerInfo = discoveredPeers.get(word);
                        const selectedPeerId = selectedPeerInfo.peerId;
                        if (selectedPeerId) {
                            try {
                                const { stream } = await test_node2.dialProtocol(selectedPeerId, '/chat/1.0.0');
                                console.log(stream.stream);
                                stream.stream.on('data', (data) => {
                                    console.log('Received message on Node A:', data.toString());
                                })

                                stream.stream.write(Buffer.from('Hello from Node A')); // may have to pipe instead

                            } catch (error) {
                                console.log(error)
                                console.error(`Failed to set up communication channel  ${selectedPeerId}`);
                            }
                        } else {
                            console.log("Invalid peer. Please try again");
                        }
                        displayOptions();
                    });
                    break;
                case '9':
                    await node.stop();
                    console.log("Node has stopped");
                    console.log("Exiting...");
                    rl.close();
                    process.exit();
                default:
                    displayOptions();
            }
        });
    }

    displayOptions();
}

function generateRandomWord() {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let word = '';
    for (let i = 0; i < 5; i++) {
        word += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return word;
}

async function main() {
    // For now we'll just create one node
    // test_node = createNode()

    // Store all the nodes we've created in a map of key=multiaddr and value=peerId 
    const NodeMap = new Map();

    getPeerID(test_node);
    getPublicKeyFromNode(test_node);

    const publicKey = getPublicKeyFromNode(test_node)

    console.log("public key belongs to this node: ", await verifyNode(test_node, publicKey));

    // When node information is requested, send it to the GUI
    const nodeInfo = getPeerID(test_node);
    // const nodePublicKey = getPublicKeyFromNode(test_node);

    // printKeyPair();

    // Can manage creation of nodes here
    // For example, subscribe to events, handle incoming messages, etc.
    // createNode("/dnsaddr/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt", NodeMap)

    // Forcefully quit main
    // process.on('SIGTERM', stop);
    // process.on('SIGINT', stop);
}

/**
 * This function creates a public/private key pair and prints the keys as well as their representation in string and hex format
 * @returns {void}
 */
async function printKeyPair() {
    try {
        const keyPair = await generateKeyPair('ed25519');
        const {_key: privateKey, _publicKey: publicKey} = keyPair
        const privateKeyString = privateKey.toString('base64'); 
        const publicKeyString = publicKey.toString('base64');   
        const publicKeyHex = publicKey.toString('hex');
        const privateKeyHex = privateKey.toString('hex');


        console.log('Public Key:', publicKey);
        console.log('Private Key:', privateKey);
        console.log("Public Key String Format:", publicKeyString);
        console.log("Private Key String Format:", privateKeyString);
        console.log("Public Key Hex Format:", privateKeyHex);
        console.log("Private Key Hex Format:", privateKeyHex);

    } catch (error) {
        console.error('Error generating key pair:', error);
    }
}

/**
 * This function generates a peerId using a generate public/private key pair
 * @returns {void}
 */

async function generatePeerId() {
    try {
      // Assuming publicKey and privateKey are available from previous operations
      const {_key: privateKey, _publicKey: publicKey} = await generateKeyPair('ed25519');
  
      const peerId = await peerIdFromKeys(publicKey, privateKey);
      console.log('Generated PeerId:', peerId);
    } catch (error) {
      console.error('Error generating PeerId:', error);
    }
  }
  
// generatePeerId();

/**
 * This function returns the peerId of a node
 * @param {Libp2p} node - the libp2p node
 * @returns {Ed25519PeerId} the peerId associated with the libp2p node
 */
function getPeerID(node) {
    // console.log(node.peerId);
    return node.peerId;
}

// console.log("PeerID of test node:", getPeerID(test_node));
// console.log("Information of known peers on the network:", await test_node.peerStore.get(getPeerID(test_node)));

// console.log("Peer Routing Information:", await test_node.peerRouting.findPeer(getPeerID(test_node)));
// should pass in peerId of another node

/**
 * This function returns the public key of a node
 * @param {Libp2p} node 
 * @returns {Uint8Array} - the public key represented as an array of 8-bit unsigned integers
 */

function getPublicKeyFromNode(node) {
    const peerId = getPeerID(node);
    try {
      if(peerId.publicKey) {
        const publicKey = peerId.publicKey;
        // console.log("Public Key:", publicKey.toString('base64'));
        return publicKey;
      } else {
        console.log("Public key is not embedded in this Peer ID.");
      }

    } catch(error) {
      console.error("Error retrieving public key:", error);
    }
}

// console.log("Public Key from test node:", getPublicKeyFromNode(test_node));

/**
 * This function returns the public key of a node
 * @param {Libp2p} node 
 * @returns {Uint8Array} the private key represented as an array of 8-bit unsigned integers
 */

function getPrivateKeyFromNode(node) {
    const peerId = getPeerID(node);
    try {
        if(peerId.privateKey) {
            const privateKey = peerId.privateKey;
            // console.log("Private Key:", privateKey.toString('base64'));
            return privateKey;
        } else {
            console.log("Private key is not embedded in this Peer ID.");
        }
    } catch(error) {
        console.error("Error retrieving private key:", error);
    }
}

/**
 * This function verifies whether the public key belongs to a node
 * @param {Libp2p} node 
 * @param {Uint8Array} publicKey - the public key associated with the libp2p node
 * @returns {boolean} True if the key belongs to the node, otherwise false
 */

async function verifyNode(peerId, publicKey) {
    const peerIdKey = await peerIdFromKeys(publicKey)

    console.log("Peer ID: ", peerId);
    console.log("Peer ID from Key:", peerIdKey);
    
    const peerIdString = peerId.toString();
    const peerIdKeyString = peerIdKey.toString();

    console.log("Peer ID String from node:", peerIdString);
    console.log("Peer ID String from Key:", peerIdKeyString);
    // Compare the string representations
    if (peerIdString === peerIdKeyString) {
        return true
    } else {
        return false
    }
}

/**
 * This function returns the multiaddress of a given node
 * @param {Libp2p} node 
 * @returns {Multiaddr} the multiaddress associated with a node
 */
function getMultiaddrs(node) {
    const multiaddrs = node.getMultiaddrs();
    const multiaddrStrings = multiaddrs.map(multiaddr => multiaddr.toString());
    return multiaddrStrings;
}

// console.log("Multiaddr of test node:", getMultiaddrs(test_node));
// console.log("Peers that are connected:", test_node.getPeers());

/**
 * This function generates a result object with specific values.
 * @param {Multiaddr} multiaddr - the multiaddr of a node
 * @returns {Object} An object with the following properties:
 * - networkProtocol: The network protocol (string).
 * - transportLayerProtocol: The transport layer protocol (string).
 * - portNumber: The port number (string).
 * - p2pPeerID: The P2P peer ID (string).
 */

function parseMultiaddr(multiaddr) {
    const components = multiaddr.split('/');
    const result = {
        networkProtocol: '',
        transportLayerProtocol: '',
        portNumber: '',
        p2pPeerID: ''
    };
  
    // Iterate through the components to fill in the result object
    components.forEach((component, index) => {
        switch (component) {
        case 'ip4':
        case 'ip6':
            result.networkProtocol = component;
            break;
        case 'tcp':
        case 'udp':
            result.transportLayerProtocol = component;
            if (components[index + 1]) {
            result.portNumber = components[index + 1];
            }
            break;
        case 'p2p':
            if (components[index + 1]) {
            result.p2pPeerID = components[index + 1];
            }
            break;
        }
    });
  
    return result;
}
  
// Example usage
const multiaddrString = '/ip4/127.0.0.1/tcp/53959/p2p/12D3KooWStnQUitCcYegaMNTNyrmPaHzLfxRE79khfPsFmUYuRmC';
const parsed = parseMultiaddr(multiaddrString);
// console.log("Example of parsing a multiaddr:", parsed);
  

// TODO: Add Encryption
// const createEd25519PeerId = async () => {
//     const key = await generateKeyPair('Ed25519')
//     const id = await createFromPrivKey(key)
  
//     if (id.type === 'Ed25519') {
//       return id
//     }
  
//     throw new Error(`Generated unexpected PeerId type "${id.type}"`)
//   }

// Abstract function for creating new nodes
// should be able to take in and register the multiaddr
async function createNode() {
    const ws = new WebSocket('ws://localhost:5173')
    const node = await createLibp2p({
        // peerId: customPeerId,
        addresses: {
            // add a listen address (localhost) to accept TCP connections on a random port
            listen: ['/ip4/0.0.0.0/tcp/0']
        },
        transports: [
            tcp()
        ],
        streamMuxers: [
            yamux()
        ],
        connectionEncryption: [
            noise()
        ],
        peerDiscovery: [
            bootstrap({
                list: [
                    // bootstrap node here is generated from dig command
                    '/dnsaddr/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
                ]
            })
        ],
        services: {
            dht: kadDHT({
                kBucketSize: 20,
            }),
            ping: ping({
                protocolPrefix: 'ipfs',
            }),
        }
    })

    // NodeMap.set(customPeerId, '/dnsaddr/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt');

        // node.connectionManager.on('peer:connect', (connection) => {
    //     console.info(`Connected to ${connection.remotePeer.toB58String()}!`)
    // })

    // console.log('listening on addresses: ')
    // node.getMultiaddrs().forEach((addr) => {
    //     console.log(addr.toString())
    // })

    // Testing purposes; Retrieve ip address of a bootstrap node:
    // dig -t TXT _dnsaddr.bootstrap.libp2p.io
    const targetAddress = '/dnsaddr/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
    
    // Replace this with ip address of market server to connect to:
    // Connect to the gRPC server
    const serverMultiaddr = '/ip4/127.0.0.1/tcp/50051'

    try {
        await node.dial(serverMultiaddr)
        // stopNode(node)
    } catch (err) {
        console.error(err)
    }

    startNode(node)

    const PROTO_PATH = __dirname + '/protos/helloworld.proto';

    // Loading package specified in proto file
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
    let helloworld_proto = grpc.loadPackageDefinition(packageDefinition).helloworld;

    // Create a gRPC client for the SendFile RPC method
    let client = new helloworld_proto.FileSender('localhost:50051', grpc.credentials.createInsecure());

    client.addFile({ hash: "12974", ip: "127.12.12", port: "80", price: "123" }, function (err, response) {
        console.log(response);
        console.log(err)
    });

    // TODO: Finish being able to retrieve peer id or unique identifier of nodes
    // return customPeerId
}

// Need to pass in the reference to the node, but maybe use a data structure to keep track?
async function startNode(node) {
    // const peerID = node.addresses[0]
    // console.log("Starting node: ", peerID)
    await node.start();
}

async function stopNode(node) {
    // const peerID = node.peerId.toB58String();
    // console.log("Stopping node: ", peerID)
    await node.stop();
}

// Connecting a node to all the peers in its network
// may want to add another parameter "neighbors" to restrict what nodes it can access
async function discoverPeers(node) {
    // Implement peer discovery mechanisms here
    // For example, using bootstrap nodes or mDNS
    try {
        // Use dig to find other examples of bootstrap node addresses
        // we can assume we have these already, hence they're hardcoded
        const bootstrapNodes = [
            '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
            '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmZvFnUfyFxkfzfjN7c1j6E1YKgKvZgoCyzp4TD5Yk3BdU'
        ];

        // Connect to each bootstrap node to discover more peers
        for (const addr of bootstrapNodes) {
            const ma = multiaddr(addr);
            await node.dial(ma);
        }

    } catch (error) {
        console.error('Peer discovery failed:', error);
    }
}

async function routeMessage(node, message, targetPeerId) {
    // Route the message to the specified target peer
}

// need to read more into pub sub testing protocols
async function exchangeData(node, peerId, data) {
    // Implement data exchange protocol here
    // Send and receive data with the specified peer
    try {
        // Publish data to a topic
        await node.pubsub.publish(topic, data);
        console.log('Data published:', data);

        // Subscribing means this node will receive notifs
        await node.pubsub.subscribe(topic, (message) => {
            console.log('Received data:', message.data.toString());
        });
        console.log('Subscribed to topic:', topic);

    } catch (error) {
        console.error('Data exchange failed:', error);
    }
}

// main()