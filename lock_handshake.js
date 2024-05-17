const INTERFACE = "web";
var BN = require('bn.js');
var Frame = require('./socket/udp_lock.js');
var hsm = require('./hsm.js');
const util = require('util');
const EventEmitter = require('events');
var LockNounce = require('./lock_nounce.js');

const WebSocket = require('ws');

const HS = {
  REFRESH_TIMEOUT: 30000
}

class LockHandshake extends EventEmitter {
  constructor () {
    if (LockHandshake._instance) {
      throw new Error("LockHandshake can't be instantiated more than once")
    }

    super();
    LockHandshake._instance = this;

    if (INTERFACE == "web") {
      this.WSS = new WebSocket.Server({ port : 8547});

      this.WSS.on('connection', function connection(ws) {
          this.handle(ws);
      }.bind(this));
    }

    this.start = new BN();
    this.end = new BN();
    this.frame = new Frame();

    this.counter = new BN(0, 16);
    this.counter_steps = new BN(1, 16);
    this.time = new BN(Math.floor(Date.now()/1000), 16);
    this.locknounce = new LockNounce(this.time, this.counter);
    this.nounce = this.server_nounce = this.Pb = 0;

    if (INTERFACE == "web") {
      this.handle = function (ws) {
        this.ws = ws;
        this.ws.on('error', console.error);

        this.ws.on('message', async function message(event) {
          console.log('received: %s', event);
          let msg = JSON.parse(event);

          switch(msg.type) {
            case 'Request':
              console.log("Request received:" + JSON.stringify(msg.nonce));
              this.Pb = msg.nonce;
              this.postEvent('request');
            break;

            case 'Response':
              console.log("Response received:" + JSON.stringify(msg.nonce));
              this.server_nounce = msg.nonce;
              this.postEvent('response');
            break;        
          }
        }.bind(this));
      };
    }
  }

  session = function () {
    this.counter = this.counter.add(this.counter_steps);
    this.time = new BN(Math.floor(Date.now()/1000), 16);
    console.log("new session " + "ts:" + this.time +
     " counter:" + this.counter + " Pb:" + JSON.stringify(this.Pb));

    this.locknounce.session.call(null, this.Pb);
  }.bind(this);

  update = function () {
     
    this.locknounce.update.call(null, this.time, this.counter);
    this.nounce = this.locknounce.nounce;
    console.log("NOUNCE:" + JSON.stringify(this.nounce));
  }.bind(this);

  solve = function (nounce) {
     
    return this.locknounce.solve.call(null, nounce);

  }.bind(this);

  isRefreshed = (n)=>{((n - this.start) > HS.REFRESH_TIMEOUT)? true:false };
  postEvent = (e)=>{process.nextTick(() => {this.emit('state_event', e);})};
};

LockHandshake.prototype.registerRequest = function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("LockHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  this.start = now;
  this.session.call();
  this.postEvent('accepted');
  return true;
}

LockHandshake.prototype.createChallenge = function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("LockHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  this.update.call();
  this.postEvent('send');
  return true;
}


LockHandshake.prototype.sendChallenge = function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("LockHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  if (INTERFACE == "web") {
    let ret = {type: 'Challenge', nonce: this.nounce} 
    this.ws.send(JSON.stringify(ret));    
  }
  else {
    this.frame.sendFrame('Challenge', this.nounce);
  }

  this.postEvent('response_pending');
  return true;
}

LockHandshake.prototype.solveChallenge = function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("LockHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  let nounce = this.server_nounce;
  let match = lock_hs.solve.call(null, nounce);

  //Send server challenge only if Pm matches
  if (match == true) {
    lock_hs.postEvent('done');
  }
  else
    lock_hs.postEvent('idle');
  return true;
}

const machine = hsm.createMachine({

  initialState: 'idle',

  idle: {

    actions: {

      onEnter() {

        //console.log('idle: onEnter')
      },

      onExit() {

        //console.log('idle: onExit')

      },

    },

    transitions: {

      request: {

        target: 'request',

        action() {

          console.log('transition action for "request" in "idle" state');

        },

      },

    },

  },

  request: {

    actions: {

      onEnter() {

        //console.log('request: onEnter')

        lock_hs.registerRequest();
      },

      onExit() {

        //console.log('request: onExit')

      },

    },

    transitions: {

      accepted: {

        target: 'challenge',

        action() {

          console.log('transition action for "accepted" in "request" state')
        },

      },

    },

  },


  challenge: {

    actions: {

      onEnter() {

        //console.log('challenge: onEnter')
        lock_hs.createChallenge();
      },

      onExit() {

        //console.log('challenge: onExit')

      },

    },

    transitions: {

      send: {

        target: 'response_pending',

        action() {

          console.log('transition action for "send" in "challenge" state')
          lock_hs.sendChallenge();
        },

      },

    },

  },

  response_pending: {

    actions: {

      onEnter() {

        //console.log('response_pending: onEnter')

      },

      onExit() {

        //console.log('response_pending: onExit')

      },

    },

    transitions: {

      response: {

        target: 'ack',

        action() {

          console.log('transition action for "response" in "response_pending" state')
          lock_hs.solveChallenge();
        },

      },

    },

  },

  ack: {

    actions: {

      onEnter() {

        //console.log('ack: onEnter')

      },

      onExit() {

        //console.log('ack: onExit')

      },

    },

    transitions: {

      done: {

        target: 'idle',

        action() {

          console.log('transition action for "done" in "ack" state')

        },

      },

    },

  }
})

let state = machine.value

//console.log(`current state: ${state}`)

//LockHandshake.prototype.
var lock_hs = new LockHandshake();

lock_hs.on('state_event', async (event) => {

  state = await machine.transition(state, event);
});

if (INTERFACE != "web") {
  lock_hs.frame.on('request', (data) => {

    lock_hs.Pb = data.pb;
    lock_hs.postEvent('request');
  });

  lock_hs.frame.on('response', (data) => {

    lock_hs.server_nounce = data.nounce; //data.slice(0, 131);
    lock_hs.postEvent('response');
  });
}

module.exports = LockHandshake;