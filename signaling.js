const SocketIo = require('socket.io');
const consola = require('consola');

const users = new Map();

let live = null;
/**
 * 
 * @param {http.Server} server 
 */
const signaling = (server) => {
  const io = new SocketIo.Server(server);

  const p2p = io.of('/p2p');

  p2p.on('connect', (socket) => {
    consola.info('[%s] connect', socket.id);

    socket.on('sdp', (data) => {
      console.log('sdp data.to[%s] type[%s]', data.to, data.type);
      const user = users.get(data.to)
      if (user) {
        user.emit('sdp', data);
      }
    });
    socket.on('ice-candidate', (data) => {
      console.log('ice-candidate data.to', data.to);
      const user = users.get(data.to)
      if (user) {
        user.emit('ice-candidate', data);
      }
    });

    socket.once('disconnect', () => {
      consola.info('[%s] disconnect', socket.id);
      users.delete(socket.id);
      p2p.emit('leave', {
        user: socket.id
      });
    });

    socket.emit('users', {
      users: Array.from(users.keys())
    });
    p2p.emit('join', {
      user: socket.id
    });


    users.set(socket.id, socket);
  });

};

module.exports = signaling;