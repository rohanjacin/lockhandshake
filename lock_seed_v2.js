const HSCurve = require('./hs_curve25519.js');
const PreShared = require('./lock_preshared.js');
const Private = require('./lock_private.js');
const BN = require('bn.js');

var pm;
var LockSeed;
(function() {
    var instance;

var counter = 0;

LockSeed = function LockSeed () {
    if (instance)
        return instance;

    counter++;

    instance = this;

    this.hscurve = new HSCurve();
	var C = this.hscurve.getCurve('secp256k1');
	this.seed = this.rpv = 0;
	this.pswd = Private.lock_password;

	this.session = function (serverPb) {

		console.log("serverPb:" + JSON.stringify(serverPb));
		let spub = new Buffer.from(serverPb.slice(0, 65));
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
		console.log("PMM:" + this.Pm.x);
		if (this.Pm.validate()) {
			//console.log("this.Pm Valid point on curve");
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

LockSeed.prototype.retrieveSeed = function (pub, seed) {

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

	if (Pm.validate()) {
		console.log("Pm valid point on curve");
	}
	else {
		console.log("Pm invalid point on curve");
		return ret;
	}

	let secret = this.hscurve.retrieveRandPrivVar('secp256k1', cipher_point_1);

	//console.log("SECRET:" + JSON.stringify(secret));
	if (secret.validate()) {
		//console.log("Secret Valid point on curve");
	}
	else {
		console.log("Secret InValid point on curve");
		return;
	}

	if (this.Pm == Pm) {
		console.log("Matched Pm.x:" + Pm.x);
		console.log("Matched Pm.y:" + Pm.y);		
	}
	//this.server_pub = cipher_point_2.x;

	return {Pm, s_seed: this.server_seed};
}

module.exports = LockSeed;