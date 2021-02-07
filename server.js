/** @type {Socket} */
const io = require('socket.io')({
    origins: ['https://seven-squares-studios.itch.io']
});

try {
    console.log('AWS:', AWS);
} catch {}

let players = {};

io.on('connection', client => {
    console.log('Client connected at', (new Date()).toTimeString());

    client.on('init', data => {
        // First get a list of all players
        const playerList = {};

        for (let key in players) {
            if (players.hasOwnProperty(key)) {
                if (players[key]) {
                    playerList[key] = {
                        id: players[key].id,
                        x: players[key].x,
                        y: players[key].y,
                        r: players[key].r,
                    };
                }
            }
        }

        const newPlayer = {
            id: client.id,
            r: 0,
            k: 0,
            ...data
        };

        client.broadcast.emit('new-player', newPlayer);
        
        client.emit('players', playerList);
        console.log('Players:', playerList);
        
        players[newPlayer.id] = newPlayer;
    });

    client.on('update', data => {
        // console.log('Update event:', data);
        try {
            const player = players[data.id];
            
            player.x = data.x ?? player.x;
            player.y = data.y ?? player.y;
            player.r = data.r ?? player.r;
            client.broadcast.emit('update', {
                id: data.id,
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
        client.broadcast.emit('remove-player', client.id);
    });
});

console.log('Waiting on users to connect');
io.listen(443);