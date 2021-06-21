/** @type {Socket} */
const io = require('socket.io')({
    cors: {
        origin: '*'
    }
});

const { performance } = require('perf_hooks');

const PORT = process.env.PORT || 3400;

/** Speed is in pixels per second */
const BASE_PLAYER_SPEED = 170;

const FPS = 3;

const DELTA_TIME = 1000 / FPS;

const DELTA_POS = (BASE_PLAYER_SPEED * DELTA_TIME) / 1000;

const ServerPlayerEventType = {
    MOVE: 0,
    ROTATION: 1
};

const GAME_WIDTH = 896;
const GAME_HEIGHT = 896;

const PlayerMovementKeys = {
    LEFT: 'moveLeft',
    RIGHT: 'moveRight',
    UP: 'moveUp',
    DOWN: 'moveDown'
};

const GameData = {
    players: {},
    matches: {}
};

GameData.players = {};

const WeaponIndex = ['AR', 'SMG', 'PISTOL'];
const Weapons = {
    AR: {
        dmg: 15,
        fr: 10,
        ma: 20,
        rt: 1700
    },
    SMG: {
        dmg: 7,
        fr: 17,
        ma: 25,
        rt: 1400
    },
    PISTOL: {
        dmg: 13,
        fr: 4,
        ma: 14,
        rt: 1000
    }
};

io.on('connection', client => {
    console.log('Client connected at', (new Date()).toTimeString());

    client.on('init', data => {
        // First get a list of all players
        const playerList = Object.entries(GameData.players).map(val => {
            return {...val[1], socket: null};
        });

        // console.log('playerList:', playerList);
        console.log('Initialization data:', JSON.stringify(data));

        const newPlayer = {
            socketID: client.id,
            // Rotation
            r: 0,
            // Kills
            k: 0,
            // Last shoot
            ls: 0,
            // is reloading
            isR: false,
            // finish reload anim
            fR: 0,
            // The object by which we'll store key pressed info
            pressedKeys: {
                [PlayerMovementKeys.LEFT]: {
                    isPressed: false,
                    lastPressed: 0
                },
                [PlayerMovementKeys.RIGHT]: {
                    isPressed: false,
                    lastPressed: 0
                },
                [PlayerMovementKeys.UP]: {
                    isPressed: false,
                    lastPressed: 0
                },
                [PlayerMovementKeys.DOWN]: {
                    isPressed: false,
                    lastPressed: 0
                },
            },
            ...data
        };

        console.log('New Player:', newPlayer);

        client.broadcast.emit('new-player', newPlayer);

        client.emit('players', playerList);
        // console.log('Players:', playerList);
        GameData.players[newPlayer.id] = {...newPlayer, socket: client};
        console.log('Players:', GameData.players);
    });

    client.on('update', deltaPacket => {
        try {
            const player = GameData.players[deltaPacket.id];

            // console.log('Player ID:', data.id);
            // console.log('Available IDs:', Object.keys(GameData.players).join(', '));

            if (player) {
                switch (deltaPacket.type) {
                    case ServerPlayerEventType.MOVE:
                        player.pressedKeys[deltaPacket.data.key].isPressed = deltaPacket.data.isPressed;
                        break;

                    case ServerPlayerEventType.ROTATION:
                        player.r = deltaPacket.r;
                        break;
                }

                client.broadcast.emit('update', {
                    id: deltaPacket.id,
                    type: deltaPacket.type,
                    data: deltaPacket.data
                });

                // console.log('update occured');
            } else {
                // console.log('player does not exist', GameData.players);
                // console.log('player does not exist');
            }
        } catch(err) {
            // 
            console.error('There was an error with update!', err);
        }
    });

    // client.on('kill', data => {
    //     // console.log('Kill event:', data);
    //     client.broadcast.emit('kill', {
    //         dead: data.d,
    //         killer: data.k
    //     });

    //     players[data.k].k += 1;
    // });

    client.on('dmg', data => {
        // 
        // {
            // d is the target being attacked, a is the attacker
        //     d: target.socketID,
        //     a: this.socketID
        // }

        if (data.d) {
            client.broadcast.emit('dmg', {
                ...data,
                dmg: Weapons[WeaponIndex[data.w]].dmg
            });
        }
    });

    client.on('disconnecting', () => {
        // console.log('Disconnecting event', client);
        findPlayer(client.id, (key, player) => {
            client.broadcast.emit('remove-player', GameData.players[key].id);
            GameData.players[key] = null;
        });
    });
});

function findPlayer(clientID, callback) {
    for (let key in GameData.players) {
        if (GameData.players.hasOwnProperty(key)) {
            if (GameData.players[key]?.socketID == clientID) {
                callback(key, GameData.players[key]);
            }
        }
    }
}

function updateGameLoop() {
    const playerList = Object.entries(GameData.players).map(val => val[1]);
    updatePlayerPositions(playerList);

    updatePlayers(playerList);

    setTimeout(updateGameLoop, DELTA_TIME);
}

function updatePlayers(players) {
    // if (players.length) {
        players.forEach(player => {
            if (player) {
                if (player.socket) {
                    player.socket.broadcast.emit('update', {
                        id: player.socket.id,
                        type: ServerPlayerEventType.MOVE,
                        x: player.x,
                        y: player.y,
                        r: player.r
                    });
                } else {
                    // console.warn("Player doesn't have a socket object? Hmm..., that's bad");
                }
            }
        })
    // }
}

function updatePlayerPositions(players) {
    if (players.length) {
        // Update the player's positions
        players.forEach(player => {
            if (player) {
                if (player.pressedKeys[PlayerMovementKeys.LEFT].isPressed) {
                    player.x -= DELTA_POS;
                } else if (player.pressedKeys[PlayerMovementKeys.RIGHT].isPressed) {
                    player.x += DELTA_POS;
                }
    
                if (player.pressedKeys[PlayerMovementKeys.UP].isPressed) {
                    player.y -= DELTA_POS;
                } else if (player.pressedKeys[PlayerMovementKeys.DOWN].isPressed) {
                    player.y += DELTA_POS;
                }
            }
        });
    }
}

updateGameLoop();

console.log('Connected to PORT: ' + PORT + '. Waiting on users to connect');
io.listen(PORT);