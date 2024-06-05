const HSCurve = require('./hs_curve25519.js');
const PreShared = require('./lock_preshared.js');
const Private = require('./lock_private.js');
const BN = require('bn.js');
const INTERFACE_S = "web";
const hotp = require('hotp');
const { hkdf } = require('@panva/hkdf');
const createHash = require( 'crypto' ).createHash;

var pm;
var LockSeed;
(function() {
    var instance;

var counter = 0;

LockSeed = function LockSeed (intf) {
    if (instance)
        return instance;

    counter++;

    instance = this;
 	this.intf = intf;
    this.hscurve = new HSCurve();
	var C = this.hscurve.getCurve('secp256k1');
	this.seed = this.rpv = 0;
	this.pswd = Private.lock_password;
	let _pm = C.point(this.pswd[0], this.pswd[1]);
	console.log("PM(lock).x:" + _pm.x);
	console.log("PM(lock).y:" + _pm.y);

	this.session = async function (serverPb) {

		console.log("serverPb:" + JSON.stringify(serverPb));
		let spub;

		if (this.intf == "web") {
			spub = new Buffer.from(serverPb.slice(0, 65));
		}
		else {
			spub = new Buffer.from(serverPb.data.slice(0, 65));			
		}
		//let sp = new BN(spub, 16);
		//console.log("sp:" + sp.toString());
	    newcurve = new HSCurve();

		this.server_pub = newcurve.createPointFromPublic('secp256k1', spub);
		//this.server_pub = this.hscurve.createPoint('secp256k1', sp);

		//console.log("PB:" + JSON.stringify(this.server_pub));
		console.log("PB.x:" + this.server_pub.x);
		console.log("PB.y:" + this.server_pub.y);

		if (this.server_pub.validate()) {
			console.log("this.server_pub Valid point on curve");
		}
		else {
			console.log("this.server_pub InValid point on curve");
		}		

		this.Pm = C.point(this.pswd[0], this.pswd[1]);
		console.log("PM(lock).x:" + this.Pm.x);
		console.log("PM(lock).y:" + this.Pm.y);

		if (this.Pm.validate()) {
			console.log("this.Pm Valid point on curve");
		}
		else {
			console.log("this.Pm InValid point on curve");
		}
		return;
	}.bind(this);

    this.update = function () {
    	//console.log("update seed:");
    	this.genSeed();
    }.bind(this);
};
}());

LockSeed.prototype.genSeed = function () {

	let ret = false;
	let point = this.hscurve.getRandPrivPoint('secp256k1');

	if (point.validate()) {
		//console.log("Valid point on curve");
	}
	else {
		console.log("Point P1 InValid point on curve");
		return ret;
	}

	if (this.server_pub.validate()) {
		//console.log("Valid point on curve");
	}
	else {
		console.log("Server Pb InValid point on curve");
		return ret;
	}

	let priv = point.getPrivate('hex');
	this.rpv = new BN(priv, 16);
	console.log("RPV:" + this.rpv.toString());

	let pubPt = point.getPublic();
	console.log("cipher_point_1.x:" + pubPt.x);
	console.log("cipher_point_1.y:" + pubPt.y);

	let pub = point.getPublic('string');
	this.rpv_pub = new BN(pub, 16);
	console.log("this.rpv_pub:" + this.rpv_pub);

	let cipher_point_1 = pub;
	console.log("cipher_point_1(pub):" + cipher_point_1);
/*	let temp = cipher_point_1.mul(ServerPrivate.server_priv);
	console.log("shared.x:" + temp.x);
	console.log("shared.y:" + temp.y);
	temp = temp.neg();
	console.log("neg shared.y:" + temp.y);*/

	let cipher_point_2 = this.server_pub;

	cipher_point_2 = cipher_point_2.mul(this.rpv);//.getX();
	console.log("shared.x:" + cipher_point_2.x);
	console.log("shared.y:" + cipher_point_2.y);	
	cipher_point_2 = cipher_point_2.add(this.Pm);
	this.seed = this.hscurve.encodePointForCipher('secp256k1', cipher_point_2);
	this.seed = new BN(this.seed, 16);
	//this.seed = cipher_point_2;
	console.log("seed:" + this.seed);
	
	if (cipher_point_2.validate()) {
		console.log("cipher_point_2 Valid point on curve");
	}
	else {
		console.log("cipher_point_2 InValid point on curve");
		return ret;
	}

	console.log("PMM.x:" + this.Pm.x);
	console.log("PMM.y:" + this.Pm.y);
	console.log("cipher_point_2.x:" + cipher_point_2.x);
	console.log("cipher_point_2.y:" + cipher_point_2.y);
		
	ret = true;
	return ret;
}

LockSeed.prototype.retrieveSeed = async function (pub, seed, guest_secret) {

	let cipher_point_1 = this.hscurve.createPointFromPublic('secp256k1', pub);
	let cipher_point_2 = this.hscurve.createPointFromPublic('secp256k1', seed);

	let ret = false;
	//let lock_priv = Private.lock_priv;

	console.log("cipher 1.x:" + cipher_point_1.x);
	console.log("cipher 1.y:" + cipher_point_1.y);
	console.log("cipher 2.x:" + cipher_point_2.x);
	console.log("cipher 2.y:" + cipher_point_2.y);

	if (cipher_point_1.validate()) {
		//console.log("Valid point on curve");
	}
	else {
		console.log("Cipher P1 InValid point on curve");
		return ret;
	}

	if (cipher_point_2.validate()) {
		//console.log("Valid point on curve");
	}
	else {
		console.log("Cipher P2 InValid point on curve");
		return ret;
	}

	console.log("cipher_point_1.inspect:" + cipher_point_1.inspect());
	let shared = cipher_point_1.mul(this.rpv); //[b(kG)]
	console.log("shared.x:" + shared.x);
	console.log("shared.y:" + shared.y);
	console.log("shared(inspect):" + shared.inspect());
	shared = shared.neg();
	console.log("neg shared.x:" + shared.x);
	console.log("neg shared.y:" + shared.y);

	let Pm = cipher_point_2.add(shared); //(Pm+[k]Pbob)−[b]([k]G)=Pm+[kb]G−[bk]G=Pm

	console.log("Pm.x:" + Pm.x);
	console.log("Pm.y:" + Pm.y);
	console.log("this.Pm.x:" + this.Pm.x);
	console.log("this.Pm.y:" + this.Pm.y);

	if (Pm.validate()) {
		console.log("Pm valid point on curve");
	}
	else {
		console.log("Pm invalid point on curve");
		return ret;
	}

	console.log("(this.Pm.x.eq(Pm.x):" + (this.Pm.x.eq(Pm.x)));
	console.log("(this.Pm.y.eq(Pm.y):" + (this.Pm.y.eq(Pm.y)));

	if ((this.Pm.x.eq(Pm.x)) && (this.Pm.y.eq(Pm.y))) {
		console.log("Matched Pm.x:" + Pm.x);
		console.log("Matched Pm.y:" + Pm.y);

		if (guest_secret) {
			// Derive Guest key and Guest messaging key
			let shared_secret_lock = this.hscurve.encodePointForCipher('secp256k1', cipher_point_2);
			let shared_secret_server = this.hscurve.encodePointForCipher('secp256k1', shared);
			let first_part = new BN(shared_secret_lock, 16);
			first_part = first_part.toString();
			let second_part = new BN(shared_secret_server, 16);
			second_part = second_part.toString();

			console.log("shared_secret_lock:", first_part);
			console.log("shared_secret_server:", second_part);

			let hash = createHash('sha256');
			hash.update(first_part);
			hash.update(second_part);
			let key = hash.digest('hex');
			let _salt = guest_secret;
			let _info = 'info';

			console.log("key:" +  key);
			console.log("_salt:" +  _salt);
			console.log("_info:" +  _info);

			let shared_key = await hkdf('sha256', key, _salt, _info, 32);

			_salt = 'guestmsgkey';
			_info = 'info';

			let shared_msg_key = await hkdf('sha256', key, _salt, _info, 32);

			let pin = hotp(shared_key, 1, {digits: 8});

			shared_key = new Buffer.from(shared_key, 32);
			shared_msg_key = new Buffer.from(shared_msg_key, 32);
			return {result:true, pin, shared_key, shared_msg_key};

		}
		else
			return {result:true};
	}

	return {result: false};
}

module.exports = LockSeed;