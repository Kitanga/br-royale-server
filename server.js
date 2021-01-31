/** @type {Socket} */
const io = require('socket.io')();

let players = {};

io.on('connection', client => {
    console.log('Client connected at', (new Date()).toTimeString());

    client.on('init', data => {
        // console.log('Init event:', data);
        // First get a list of all players
        const playerList = [];

        for (let key in players) {
            if (players.hasOwnProperty(key)) {
                if (players[key]) {
                    playerList.push(players[key]);
                }
            }
        }

        const newPlayer = {
            id: client.id,
            r: 0,
            k: 0,
            ...data
        };

        players[newPlayer.id] = newPlayer;

        client.broadcast.emit('new-player', newPlayer);

        client.emit('players', playerList);
    });

    client.on('update', data => {
        // console.log('Update event:', data);
        try {
            players[client.id].x = data.x ?? players[client.id].x;
            players[client.id].y = data.y ?? players[client.id].y;
            players[client.id].r = data.r ?? players[client.id].r;
            client.broadcast.emit('update', {
                id: client.id,
                ...data
            });
        } catch {
            // 
        }
    });

    client.on('kill', data => {
        // console.log('Kill event:', data);
        client.broadcast.emit('kill', {
            dead: data.d,
            killer: data.k
        });

        players[data.k].k += 1;
    });

    client.on('disconnecting', () => {
        // console.log('Disconnecting event', client);
        players[client.id] = null;
        client.broadcast.emit('disconnected', client.id);
    });
});

console.log('Waiting on users to connect');
io.listen(3400);