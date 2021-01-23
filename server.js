/** @type {Socket} */
const io = require('socket.io')();
io.on('connection', client => {
    console.log('Client connected at', (new Date()).toTimeString());
});
io.listen(3400);