var BN = require('bn.js');
var Frame = require('./socket/udp_lock.js');
var hsm = require('./hsm.js');
const util = require('util');
const EventEmitter = require('events');
var LockNounce = require('./lock_nounce.js');

const HS = {
  REFRESH_TIMEOUT: 30000
}

var LockHandshake;
(function() {
    var instance;

LockHandshake = function LockHandshake () {
    if (instance)
        return instance;

  instance = this;
  EventEmitter.call(this);

  this.start = new BN();
  this.end = new BN();
  this.frame = new Frame();

  let counter = new BN(0, 16);
  let counter_steps = new BN(1, 16);
  let time = new BN(Math.floor(Date.now()/1000), 16);
  let locknounce = new LockNounce(time, counter);
  this.nounce = this.server_nounce = this.Pb = 0;

  this.session = function () {
    counter = counter.add(counter_steps);
    time = new BN(Math.floor(Date.now()/1000), 16);
    console.log("new session " + "ts:" + time +
     " counter:" + counter + " Pb:" + JSON.stringify(this.Pb));

    locknounce.session.call(null, this.Pb);
  }.bind(this);

  this.update = function () {
     
    locknounce.update.call(null, time, counter);
    this.nounce = locknounce.nounce;
    console.log("NOUNCE:" + JSON.stringify(this.nounce));
  }.bind(this);

  this.solve = function (nounce) {
     
    return locknounce.solve.call(null, nounce);

  }.bind(this);

  this.isRefreshed = (n)=>{((n - this.start) > HS.REFRESH_TIMEOUT)? true:false };
  this.postEvent = (e)=>{process.nextTick(() => {this.emit('state_event', e);})};
};
}());

util.inherits(LockHandshake, EventEmitter);

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

  this.frame.sendFrame('Challenge', this.nounce);
  //this.postEvent('response_pending');
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

        console.log('response_pending: onEnter')

      },

      onExit() {

        console.log('response_pending: onExit')

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

        console.log('ack: onEnter')

      },

      onExit() {

        console.log('ack: onExit')

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

console.log(`current state: ${state}`)

//LockHandshake.prototype.
var lock_hs = new LockHandshake();

lock_hs.on('state_event', (event) => {

  state = machine.transition(state, event);
});

lock_hs.frame.on('request', (data) => {

  lock_hs.Pb = data.pb;
  lock_hs.postEvent('request');
});

lock_hs.frame.on('response', (data) => {

  lock_hs.server_nounce = data.nounce; //data.slice(0, 131);
  lock_hs.postEvent('response');
});

module.exports = LockHandshake;