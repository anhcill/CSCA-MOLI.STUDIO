/**
 * Singleton Socket.io instance
 * Set by index.js after initSocket() is called
 * Controllers can import this to emit events
 */
let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  return ioInstance;
}

module.exports = { setIO, getIO };
