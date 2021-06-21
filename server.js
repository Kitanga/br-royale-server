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

const spawnPoints = [
    [528, 16],
    [880, 240],
    [752, 880],
    [48, 880],
    [16, 240]
];

const ServerPlayerEventType = {
    MOVE: 0,
    ROTATION: 1
};

const GAME_WIDTH = 896;
const GAME_HEIGHT = 896;

const PlayerKeys = {
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
        const playerList = JSON.parse(JSON.stringify(GameData.players));

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
                [PlayerKeys.LEFT]: {
                    isPressed: false,
                    lastPressed: 0
                },
                [PlayerKeys.RIGHT]: {
                    isPressed: false,
                    lastPressed: 0
                },
                [PlayerKeys.UP]: {
                    isPressed: false,
                    lastPressed: 0
                },
                [PlayerKeys.DOWN]: {
                    isPressed: false,
                    lastPressed: 0
                },
            },
            lastX: data.x,
            lastY: data.y,
            ...data,
            h: 100
        };

        console.log('New Player:', newPlayer);

        client.broadcast.emit('new-player', newPlayer);

        client.emit('players', playerList);
        // console.log('Players:', playerList);
        
        GameData.players[newPlayer.id] = newPlayer;
        console.log('Players:', GameData.players);
    });

    client.on('update', data => {
        try {
            const player = GameData.players[data.id];

            // console.log('Player ID:', data.id);
            // console.log('Available IDs:', Object.keys(GameData.players).join(', '));

            if (player) {
                switch (data.type) {
                    case ServerPlayerEventType.MOVE:
                        const isNotCheating = processMovement(data, player, client);
                        if (isNotCheating) {
                            client.broadcast.emit('update', {
                                id: data.id,
                                type: data.type,
                                x: data.x,
                                y: data.y,
                                data: data.data
                            });
                        } else {
                            client.disconnect();
                        }
                        break;

                    case ServerPlayerEventType.ROTATION:
                        player.r = data.r;
                        client.broadcast.emit('update', {
                            id: data.id,
                            r: player.r,
                            ...data,
                        });
                        break;
                }

                // client.broadcast.emit('update', {
                //     id: data.id,
                //     ...data,
                //     x: player.x,
                //     y: player.y,
                //     r: player.r
                // });
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

        // console.log('Damage!', data);

        if (data.d) {
            const dmg = Weapons[WeaponIndex[data.w]].dmg;

            const player = GameData.players[data.d];

            if (player) {
                player.h -= Math.max(0, dmg);

                if (player.h > 0) {
                    client.broadcast.emit('dmg', {
                        ...data,
                        dmg
                    });
                } else {
                    player.h = 100;
                    const respawnPointIndex = getSpawnPointIndex();
                    const [x, y] = spawnPoints[respawnPointIndex];
                    player.lastX = x;
                    player.lastY = y;
                    client.emit('respawn', respawnPointIndex);
                }
            }
        } else {
            client.broadcast.emit('dmg', {
                a: data.a,
                w: data.w,
                x: data.x,
                y: data.y
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

function processMovement(data, player, client) {
    if (data.data.isPressed) {
        player.pressedKeys[data.data.key].lastPressed = performance.now();
        player.lastX = data.x;
        player.lastY = data.y;
        return true;
    } else {
        const deltaTime = performance.now() - player.pressedKeys[data.data.key].lastPressed;

        const deltaPos = ((BASE_PLAYER_SPEED * deltaTime) / 1000) + 100;

        // if (typeof player.lastX !== 'undefined' && typeof player.lastY !== 'undefined') {
        if (Math.abs(data.x - player.lastX) > deltaPos || Math.abs(data.y - player.lastY) > deltaPos) {
            return false;
        } else {
            player.lastX = data.x;
            player.lastY = data.y;

            return true;
        }
        // }

        return true;

        // console.log('Delta Pos:', deltaPos);

        // switch (data.data.key) {
        //     case PlayerKeys.LEFT:
        //         player.x -= deltaPos;
        //         player.x = Math.max(0, Math.min(GAME_WIDTH, player.x));
        //         client.broadcast.emit('update', {
        //             id: data.id,
        //             x: player.x,
        //             type: ServerPlayerEventType.MOVE
        //         });
        //         break;
        //     case PlayerKeys.RIGHT:
        //         player.x += deltaPos;
        //         player.x = Math.max(0, Math.min(GAME_WIDTH, player.x));
        //         client.broadcast.emit('update', {
        //             id: data.id,
        //             x: player.x,
        //             type: ServerPlayerEventType.MOVE
        //         });
        //         break;
        //     case PlayerKeys.UP:
        //         player.y -= deltaPos;
        //         player.y = Math.max(0, Math.min(GAME_HEIGHT, player.y));
        //         client.broadcast.emit('update', {
        //             id: data.id,
        //             y: player.y,
        //             type: ServerPlayerEventType.MOVE
        //         });
        //         break;
        //     case PlayerKeys.DOWN:
        //         player.y += deltaPos;
        //         player.y = Math.max(0, Math.min(GAME_HEIGHT, player.y));
        //         client.broadcast.emit('update', {
        //             id: data.id,
        //             y: player.y,
        //             type: ServerPlayerEventType.MOVE
        //         });
        //         break;
        // }
    }
    // player.pressedKeys[data.data.key].isPressed = data.data.isPressed;
}

/**
 * Returns the distance between 2 points
 * @param {*} x1 
 * @param {*} y1 
 * @param {*} x2 
 * @param {*} y2 
 * @returns number
 */
function DistanceBetween(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;

    return Math.sqrt(dx * dx + dy * dy);
};

function getSpawnPointDistanceSum(spawnPointIndex) {
    const spawnPoint = spawnPoints[spawnPointIndex];

    const playerList = Object.entries(GameData.players);

    if (playerList.length) {
        const totalDistance = playerList
            .filter(val => val[1])
            .map(val => val[1])
            .map((player) => {
                return {
                    x: player.x,
                    y: player.y
                };
            })
            .map(pos => {
                if (typeof pos.x !== 'undefined' && typeof pos.y !== 'undefined') {
                    return DistanceBetween(spawnPoint[0], spawnPoint[1], pos.x, pos.y);
                } else {
                    return 0;
                }
            })
            .reduce((acc, currentVal) => acc + currentVal);

        return totalDistance;
    } else {
        return 0;
    }
}

function getSpawnPointIndex() {
    const spawnIndex = spawnPoints.map((point, ix) => {
        return {
            sum: getSpawnPointDistanceSum(ix),
            index: ix
        };
    })
    .sort((a, b) => b.sum - a.sum)[0].index;

    return spawnIndex;
}

console.log('Connected to PORT: ' + PORT + '. Waiting on users to connect');
io.listen(PORT);