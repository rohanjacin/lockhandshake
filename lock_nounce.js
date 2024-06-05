var BN = require('bn.js');
var createHash = require( 'crypto' ).createHash;
var createHmac = require( 'crypto' ).createHmac;
const Ethers = require('ethers');
const PreShared = require('./lock_preshared.js');
var LockSeed = require('./lock_seed_v2.js');
var LockSalt = require('./lock_salt.js');
var LockNounce;

(function() {
    var instance;

var counter = 0;

LockNounce = function LockNounce (ts, ct, intf) {
    if (instance)
        return instance;

    instance = this;
    this.intf = intf;
    let seed = new LockSeed(this.intf);
	let salt = new LockSalt(this.intf);
	this.rpv = this.salt = this.ts = this.seed = this.ct = this.lcs = 0;
	this.init = function (_ts, _ct) {
	    
	    this.ts = _ts.toBuffer(4);
	    this.ct = _ct.toBuffer(2);
	    this.lcs = PreShared.lock_signature.toBuffer(32);
	}.bind(this);

	this.init(ts, ct);

    this.session = async function (serverPb, validation) {

		if (validation) {
			let _data;
			this.inf == "web" ? _data = new Buffer.from(serverPb.slice(0, 65)) :
						_data = new Buffer.from(serverPb.data.slice(0, 65));

			if (false == await this.validate(_data, validation))
			return;
		}
		await seed.session.call(null, serverPb);
		await salt.session.call(null);
    }.bind(this);

    this.update = function (ts_, ct_) {
    	seed.update.call();
    	this.seed = seed.seed.toBuffer(32);
    	this.rpv_pub = seed.rpv_pub.toBuffer(32);
    	this.rpv = seed.rpv.toBuffer(32);

    	salt.update.call();
    	this.salt = salt.salt.toBuffer(32);
    	
    	this.init(ts_, ct_);
    	this.nounce = this.genNounce();
    }.bind(this);

    this.solve = async function (nounce, guest_secret, validation) {

		if (validation) {
			let _data;
			this.inf == "web" ? _data = new Buffer.from(nounce.slice(0, 65)) :
							_data = new Buffer.from(nounce.data.slice(0, 65));

			if (false == await this.validate(_data, validation))
				return;
		}
		return await this.solveNounce(nounce, seed, salt, guest_secret);

    }.bind(this);

    this.validate = async function (data, validation) {
		let ownersig, _ownersig;
		let guestsig, _guestsig;
		let guest, _guest;
		let _spub;

		if (this.intf == "web") {
			ownersig = new Buffer.from(validation.slice(0, 65));
			_ownersig = "0x" + ownersig.toString('hex');
			guestsig = new Buffer.from(validation.slice(65, 130));
			_guestsig = "0x" + guestsig.toString('hex');
			guest = new Buffer.from(validation.slice(130, 151));
			_guest = "0x" + guest.toString('hex');
		}
		else {
			ownersig = new Buffer.from(validation.data.slice(0, 65));
			_ownersig = "0x" + ownersig.toString('hex');
			guestsig = new Buffer.from(validation.data.slice(65, 130));
			_guestsig = "0x" + guestsig.toString('hex');
			guest = new Buffer.from(validation.data.slice(130, 151));
			_guest = "0x" + guest.toString('hex');
		}

		let ret = false;

		console.log("ownersig:", _ownersig);
		console.log("guestsig:", _guestsig);
		console.log("guest:", guest);

		// Verify owner signature
	    let hash = createHash('sha256');
	    hash.update(data);
	    hash.update(guest);
	    let msg = hash.digest();

	    let address = Ethers.verifyMessage(msg, _ownersig);
	    console.log("owner's address:", address);
	    console.log("PreShared.server_address:", PreShared.server_address);

	    // Check if owner's address matches
	    if (PreShared.server_address == address) {

			// Verify guest's signature
			hash = createHash('sha256');
			hash.update(ownersig);
			msg = hash.digest();

			address = Ethers.verifyMessage(msg, _guestsig);
			address = address.toLowerCase();
			console.log("guest addess:", address);
			console.log("_guest:", _guest);

			// Check if guest's signature matches
			if (_guest == address) {
				ret = true;
			}
	    }

	    return ret;
	}
};
}());

LockNounce.prototype.genNounce = function () {

	let hash = createHash('sha256');
	hash.update(this.ts);
	hash.update(this.rpv);
	hash.update(this.lcs);
	//this.nounce0 = new BN(hash.digest('hex'), 16);
	//this.nounce0 = this.nounce0.toBuffer(32);
	this.nounce0 = new BN(this.rpv_pub, 16);
	this.nounce0 = this.nounce0.toBuffer(32);

	hash = createHash('sha256');
	hash.update(this.salt);
	hash.update(this.ct);
	hash.update(this.lcs);
	this.nounce1 = new BN(hash.digest('hex'), 16);
	this.nounce1 = this.nounce1.toBuffer(32);

	let length = this.nounce0.length + this.nounce1.length +
				 this.seed.length + this.ct.length;

	let data = Buffer.concat([this.nounce0, this.nounce1,
					this.seed, this.ct], length);

  	var hmac = createHmac( 'sha256', PreShared.shared_key ).update( data ).digest()
  	//console.log("hmac:" + JSON.stringify(hmac));
  	length = length + hmac.length;
  	//console.log("hmac:" + hmac);
	let nounce = Buffer.concat([data, hmac], length);
	return nounce;
}

LockNounce.prototype.solveNounce = async function (nounce, seed_obj,
									salt_obj, guest_secret) {

	let nounce0;
	let nounce1;
	let seed;
	let counter;

	if (this.intf == "web") {
		nounce0 = new Buffer.from(nounce.slice(0, 65));
		nounce1 = new Buffer.from(nounce.slice(65, 97));
		seed = new Buffer.from(nounce.slice(97, 162));
		counter = new Buffer.from(nounce.slice(162, 163));		
	}
	else {
		nounce0 = new Buffer.from(nounce.data.slice(0, 65));
		nounce1 = new Buffer.from(nounce.data.slice(65, 97));
		seed = new Buffer.from(nounce.data.slice(97, 162));
		counter = new Buffer.from(nounce.data.slice(162, 163));
	}

	let server_pub = nounce0;
	//let server_pub = new BN(nounce0, 16);
	//this.server_pub = this.server_pub.toString();
	let server_seed = seed;
	//let server_seed = new BN(seed, 16);
	//this.server_seed = this.server_seed.toString();
	let server_counter = new BN(counter, 16);

/*	console.log("server_pub:" + JSON.stringify(server_pub));
	console.log("server_seed:" + JSON.stringify(server_seed));
	console.log("server_counter:" + JSON.stringify(server_counter));
*/
	let result = await seed_obj.retrieveSeed(server_pub, server_seed, guest_secret);
	return result;

	//console.log("server pm.x:" + Pm.x);
	//console.log("server pm.y:" + Pm.y);
	//if (Pm == this.pm)
	//	console.log("\nMMMMMATCCHHH(lock)");
	
/*	console.log('_lock_seed:' + (s_seed instanceof BN));
	let _seed = s_seed.toString(); 
	console.log("__seed:" + _seed);
	let server_salt = salt_obj.retrieveSalt(1, 2, _seed);
	console.log("server_salt:" + server_salt);

	hash = createHash('sha256');
	hash.update(server_salt.toBuffer(32));
	hash.update(server_counter.toBuffer(32));
	hash.update(PreShared.server_signature.toBuffer(32));
	let server_nounce1 = new BN(hash.digest('hex'), 16);
	console.log("server_nounce1:" + server_nounce1);

	let _nounce1 = new BN(nounce1, 16);
	console.log("nounce1111:" + _nounce1.toString());
	if (server_nounce1.toString() == _nounce1.toString()) {
		console.log("\n\nNounce Match");
		return true;
	}

	return false;
*/
/*	let hash = createHash('sha256');
	hash.update(this.ts);
	hash.update(this.rpv);
	hash.update(this.lcs);
	//this.nounce0 = new BN(hash.digest('hex'), 16);
	//this.nounce0 = this.nounce0.toBuffer(32);
	this.nounce0 = this.rpv.toBuffer(32);

	//console.log("nounce0:" + this.nounce0);
	hash = createHash('sha256');
	hash.update(this.salt);
	hash.update(this.ct);
	hash.update(this.lcs);
	this.nounce1 = new BN(hash.digest('hex'), 16);
	this.nounce1 = this.nounce1.toBuffer(32);
	//console.log("nounce1:" + this.nounce1);
	console.log("nounce0:" + JSON.stringify(this.nounce0));
	console.log("nounce1:" + JSON.stringify(this.nounce1));
	console.log("seed:" + JSON.stringify(this.seed));
	console.log("ct:" + JSON.stringify(this.ct));

	console.log("nounce0.length:" + this.nounce0.length);
	console.log("nounce1.length:" + this.nounce1.length);
	console.log("seed.length:" + this.seed.length);
	console.log("ct.length:" + this.ct.length);

	//console.log("seed.length:" + this.seed.length);
	//console.log("ct.length:" + this.ct.length);
	let length = this.nounce0.length + this.nounce1.length +
				 this.seed.length + this.ct.length;
	//console.log("length:" + length);

	let data = Buffer.concat([this.nounce0, this.nounce1,
					this.seed, this.ct], length);
	//console.log("data:" + JSON.stringify(data));

  	var hmac = createHmac( 'sha256', PreShared.shared_key ).update( data ).digest()
  	//console.log("hmac:" + JSON.stringify(hmac));
  	length = length + hmac.length;
  	//console.log("hmac:" + hmac);
	let nounce = Buffer.concat([data, hmac], length);
	//console.log("nounce:" + JSON.stringify(nounce));
	//console.log("nounce.length:" + nounce.length);
	return nounce;*/
}

let ts = new BN('216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51d', 16);
let ct = new BN('fffe', 16);;

let ts1 = new BN('316936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51d', 16);
let ct1 = new BN('ffee', 16);;

module.exports = LockNounce;