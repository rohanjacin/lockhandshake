var BN = require('bn.js');
var createHash = require( 'crypto' ).createHash;
var LockSeed = require('./lock_seed_v2.js');

var LockSalt;
(function() {
    var instance;

var counter = 0;

LockSalt = function LockSalt (intf) {
    if (instance)
        return instance;

    counter++;

    instance = this;
    this.intf = intf;
    
    let ls = new LockSeed(this.intf);
    this.startTs = this.endTs = this.seed = this.salt =0;

    this.session = async function () {
        //console.log("session salt:");
    }.bind(this);

    this.update = function () {
    	//console.log("update salt:");
        this.seed = ls.seed.toBuffer(32);
    	this.salt = this.genSalt(1, 2);
    }.bind(this);    
};
}());

LockSalt.prototype.genSalt = function (start, period) {
	this.start = start;
	this.end = start + period;
	let hash = createHash('sha256');
	hash.update(this.seed);
	let salt = hash.digest('hex');
	salt = new BN(salt, 16);
	console.log('salt:' + salt);
    this.salt = salt;
	return salt;
}

LockSalt.prototype.retrieveSalt = function (start, period, seed) {
    let end = start + period;
    let hash = createHash('sha256');
    hash.update(seed);
    let salt = hash.digest('hex');
    salt = new BN(salt, 16);
    console.log('salt:' + salt);
    return salt;
}

module.exports = LockSalt;