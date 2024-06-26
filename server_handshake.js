var BN = require('bn.js');
var hsm = require('./hsm.js');
var Frame = require('./socket/udp_server.js');
const util = require('util');
const EventEmitter = require('events');
var ServerNounce = require('./server_nounce.js');
const { LockProver } = require("./prover.js");

const WebSocket = require('ws');

const HS = {
  REFRESH_TIMEOUT: 30000
}

class ServerHandshake extends EventEmitter {
  constructor (intf) {
    if (ServerHandshake._instance) {
      throw new Error("ServerHandshake can't be instantiated more than once")
    }

    super();
    ServerHandshake._instance = this;
    this.intf = intf;

    if (this.intf == "web") {
      this.WSS = new WebSocket.Server({ port : 8546});

      this.WSS.on('connection', function connection(ws) {
          this.handle(ws);
      }.bind(this));
    }
    this.start = new BN();
    this.end = new BN();

    if (this.intf != "web") {
      this.frame = new Frame();
    }
    this.counter = new BN(0, 16);
    this.counter_steps = new BN(1, 16);
    this.time = new BN(Math.floor(Date.now()/1000), 16);
    this.servernounce = new ServerNounce(this.time, this.counter, this.intf);
    this.nounce = this.servernounce.nounce;
    this.lock_nounce = 0;
    this.ws;
    this.lockprover = new LockProver();

    if (this.intf == "web") {
      this.handle = function (ws) {
        this.ws = ws;
        this.ws.on('error', console.error);

        this.ws.on('message', async function message(event) {
          console.log('received: %s', event);
          let msg = JSON.parse(event);

          switch(msg.type) {
            case 'Request':
              this.postEvent('start');
            break;

            case 'Challenge':
              console.log("MSG:" + JSON.stringify(msg));
              this.lock_nounce = msg.nonce;
              this.postEvent('challenge');
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
     " counter:" + this.counter /*+ " nounce:" + JSON.stringify(servernounce.nounce)*/);
    return this.servernounce.session.call(null, this.time);

  }.bind(this);

  update = function () {

    //console.log("Handshake Session Update");
    this.servernounce.update.call(null, this.time, this.counter);
    this.nounce = this.servernounce.nounce;

    console.log("\nSERVER NONCE:" + JSON.stringify(this.nounce));
    //console.log("\nLENGTH:" + this.nounce.length);

  }.bind(this);

  solve = async function (nounce) {
     
    console.log("In solve(hs):" + JSON.stringify(nounce)); 
    return await this.servernounce.solve.call(null, nounce);

  }.bind(this);

  isRefreshed = (n)=>{((n - this.start) > HS.REFRESH_TIMEOUT)? true:false };
  postEvent = (e)=>{process.nextTick(() => {this.emit('state_event', e);})};
  postEventToContract = (e, data)=>{process.nextTick(() => {this.emit('contract_event', e, data);})};
};

ServerHandshake.prototype.sendRequest = async function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  console.log("sendRequest...");
  if (this.isRefreshed(now) == false) {

    console.log("ServerHandshake FSM not refreshed");
    this.postEvent('idle');
    return null;
  }

  this.start = now;
  let {Pb} = await this.session.call();
  console.log("Pb:" + Pb.toString());

  Pb = Pb.toBuffer(32);

  if (this.intf == "web") {
    return {type: "Request", nonce: Pb};
  }
  else {
    this.frame.sendFrame('Request', Pb);
    this.postEvent('request');
    return true;
  }
}

ServerHandshake.prototype.waitChallenge = function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("ServerHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  return true;
}

ServerHandshake.prototype.solveChallenge = async function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  console.log("solveChallenge");
  if (this.isRefreshed(now) == false) {

    console.log("ServerHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  let nounce = this.lock_nounce;
  console.log("nounce:" + JSON.stringify(nounce));

  let match = await this.solve(nounce);

  //Send server challenge only if Pm matches
  if (match == true) {
    this.postEvent('validated');
  }
  else
    this.postEvent('idle');
  return true;
}

ServerHandshake.prototype.createChallenge = function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("ServerHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  this.update.call();
  this.postEvent('send');
  return true;
}

ServerHandshake.prototype.sendChallenge = async function () {
  let now = new BN(Math.floor(Date.now()/1000), 16);

  if (this.isRefreshed(now) == false) {

    console.log("ServerHandshake FSM not refreshed");
    this.postEvent('idle');
    return false;
  }

  if (this.intf == "web") {
    // Create proof here
    this.lockprover.update();
    let { proof, publicSignals } = await this.lockprover.prove(); 

    let msg = {type: 'Response', nonce: this.nounce,
        ownerproof: {proof, publicSignals}};
    this.ws.send(JSON.stringify(msg));
    this.postEvent('ack_pending');
  }
  else {
    this.frame.sendFrame('Response', this.nounce);
    //this.postEventToContract("response", this.nounce);
  }

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

      start: {

        target: 'idle',

        async action() {

          console.log('transition action for "start" in "idle" state');
          
          if (server_hs.intf == "web") {

            let {type, nonce} = await server_hs.sendRequest();
            server_hs.ws.send(JSON.stringify({type, nonce}));
          }
        },

      },

      request: {

        target: 'waiting',

        action() {

          console.log('transition action for "request" in "idle" state');


        },

      },

    },

  },

  waiting: {

    actions: {

      onEnter() {

        server_hs.waitChallenge();
      },

      onExit() {

        //console.log('waiting: onExit')

      },

    },

    transitions: {

      challenge: {

        target: 'response',

        async action() {

          console.log('transition action for "challenge" in "waiting" state')
          await server_hs.solveChallenge();
        },

      },

    },

  },


  response: {

    actions: {

      onEnter() {

        console.log('challenge: onEnter')
        
      },

      onExit() {

        console.log('challenge: onExit')

      },

    },

    transitions: {

      validated: {

        target: 'response',

        action() {
          server_hs.createChallenge();
        }
      },

      send: {

        target: 'ack_pending',

        async action() {

          console.log('transition action for "send" in "challenge" state')
          await server_hs.sendChallenge();
        },

      },

    },

  },

  ack_pending: {

    actions: {

      onEnter() {

        console.log('ack_pending: onEnter')

      },

      onExit() {

        console.log('ack_pending: onExit')

      },

    },

    transitions: {

      response: {

        target: 'ack',

        action() {

          console.log('transition action for "response" in "response_pending" state')

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

//ServerHandshake.prototype.
var server_hs = new ServerHandshake(process.env.INTERFACE);


server_hs.on('state_event', async (event) => {

  state = await machine.transition(state, event);
});

if (server_hs.intf != "web") {
  server_hs.frame.on('request', (data) => {

    server_hs.postEvent('request');
  });

  server_hs.frame.on('challenge', (data) => {

    server_hs.lock_nounce = data.nounce; //data.slice(0, 131);
    server_hs.postEvent('challenge');
  });
}

if (server_hs.intf != "web")
  server_hs.sendRequest();

module.exports = ServerHandshake;