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
  constructor (intf) {
    if (LockHandshake._instance) {
      throw new Error("LockHandshake can't be instantiated more than once")
    }

    super();
    LockHandshake._instance = this;
    this.intf = intf;

    if (this.intf == "web") {
      this.WSS = new WebSocket.Server({ port : 8547});

      this.WSS.on('connection', function connection(ws) {
          this.handle(ws);
      }.bind(this));
    }

    this.start = new BN();
    this.end = new BN();
    this.match = false;
    this.pin = '';
    this.shared_key = '';
    this.shared_msg_key = '';
    this.guest_secret = '';

    if (this.intf != "web") {
      this.frame = new Frame();
    }
    this.counter = new BN(0, 16);
    this.counter_steps = new BN(1, 16);
    this.time = new BN(Math.floor(Date.now()/1000), 16);
    this.locknounce = new LockNounce(this.time, this.counter, this.intf);
    this.nounce = this.server_nounce = this.Pb = 0;

    if (this.intf == "web") {
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
              this.validation = msg.validation;
              this.postEvent('request');
            break;

            case 'Response':
              console.log("Response received:" + JSON.stringify(msg.nonce));
              this.server_nounce = msg.nonce;
              this.guest_secret = msg.secret;
              this.validation = msg.validation;
              this.postEvent('response');
            break;        
          }
        }.bind(this));
      };
    }
  }

  session = async function () {
    this.counter = this.counter.add(this.counter_steps);
    this.time = new BN(Math.floor(Date.now()/1000), 16);
    console.log("new session " + "ts:" + this.time +
     " counter:" + this.counter + " Pb:" + JSON.stringify(this.Pb));

    await this.locknounce.session.call(null, this.Pb, this.validation);
  }.bind(this);

  update = function () {
     
    this.locknounce.update.call(null, this.time, this.counter);
    this.nounce = this.locknounce.nounce;
    console.log("NOUNCE:" + JSON.stringify(this.nounce));
  }.bind(this);

  solve = async function (nounce, guest_secret, validation) {
     
     console.log("NONCEEE:", nounce);
    return await this.locknounce.solve.call(null, nounce, guest_secret, validation);

  }.bind(this);

  isRefreshed = (n)=>{((n - this.start) > HS.REFRESH_TIMEOUT)? true:false };
  postEvent = (e)=>{process.nextTick(() => {this.emit('state_event', e);})};
};

LockHandshake.prototype.registerRequest = async function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("LockHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  this.start = now;

  await this.session.call();
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

  if (this.intf == "web") {
    let ret = {type: 'Challenge', nonce: this.nounce} 
    this.ws.send(JSON.stringify(ret));    
  }
  else {
    this.frame.sendFrame('Challenge', this.nounce);
  }

  this.postEvent('response_pending');
  return true;
}

LockHandshake.prototype.solveChallenge = async function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("LockHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  let nounce = this.server_nounce;
  let guest_secret = this.guest_secret;

  let ret = await lock_hs.solve.call(null, nounce, guest_secret, this.validation);

  if ((ret.result == true) && (ret.pin) &&
      (ret.shared_key) && (ret.shared_msg_key)) {
    this.match = true;
    this.pin = ret.pin;
    this.shared_key = ret.shared_key;
    this.shared_msg_key = ret.shared_msg_key;
    console.log("this.pin:" + this.pin);
    console.log("this.shared_key:" + this.shared_key);
    console.log("this.shared_msg_key:" + this.shared_msg_key);
  }
  else {
    this.match = false;
    this.pin = '';
    this.shared_key = '';
    this.shared_msg_key = '';
  }

  //Send server challenge only if Pm matches
  if (this.match == true) {
    lock_hs.postEvent('send');
  }
  else
    lock_hs.postEvent('idle');
  return true;
}

LockHandshake.prototype.sendAck = function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("LockHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  if (this.intf == "web") {
    let ret = {type: 'Ack', result: this.match, pin: this.pin,
                shared_key: this.shared_key,
                shared_msg_key: this.shared_msg_key}

    console.log("Sening Ack:" + JSON.stringify(ret));
    this.ws.send(JSON.stringify(ret));
  }
  else {
    this.frame.sendFrame('Ack', this.match);
  }

  this.postEvent('idle');
  return true;
}

const machine = hsm.createMachine({

  initialState: 'idle',

  idle: {

    actions: {

      onEnter() {

        //console.log('idle: onEnter')
        lock_hs.match = false;
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

      async onEnter() {

        console.log('request: onEnter')

        await lock_hs.registerRequest();
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

        async action() {

          console.log('transition action for "response" in "response_pending" state')
          await lock_hs.solveChallenge();
        },

      },

    },

  },

  ack: {

    actions: {

      onEnter() {

        console.log('ack: onEnter')

      },

      onExit() {

        console.log('ack: onExit')

      },

    },

    transitions: {

      send: {

        target: 'idle',

        action() {

          console.log('transition action for "send" in "ack" state')
          lock_hs.sendAck();
        },

      },

    },

  }
})

let state = machine.value

//console.log(`current state: ${state}`)

//LockHandshake.prototype.
var lock_hs = new LockHandshake(process.env.INTERFACE);

lock_hs.on('state_event', async (event) => {

  state = await machine.transition(state, event);
});

if (lock_hs.intf != "web") {
  lock_hs.frame.on('request', (data) => {

    lock_hs.Pb = data.pb;
    lock_hs.validation = data.validation;
    console.log("lock_hs.validation:", lock_hs.validation);
    lock_hs.postEvent('request');
  });

  lock_hs.frame.on('response', (data) => {

    lock_hs.server_nounce = data.nonce; //data.slice(0, 131);
    lock_hs.guest_secret = data.secret;
    lock_hs.validation = data.validation;
    lock_hs.postEvent('response');
  });
}

module.exports = LockHandshake;