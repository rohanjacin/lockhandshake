const nobleed25519_path = '/home/rently/rently/projects/noble-ed25519';
const ExtPoint = require(nobleed25519_path).ExtendedPoint;
const Point = require(nobleed25519_path).Point;
const Curve = require(nobleed25519_path).Curve;
const HSCurve = require('./hs_curve25519.js');
const PreShared = require('./lock_preshared.js');
const BN = require('bn.js');

const lock_password = '7468697320697320612074c3a97374';

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
	var C = this.hscurve.getCurve('ed25519');
	let a = BigInt((C.a - C.p - 1).toString(10));
	let d = BigInt(C.d.toString(10));
	let p = BigInt(C.p.toString(10));
	let n = BigInt(C.n.toString(10));
	let gx = BigInt(C.g.x.toString(10));
	//console.log("gx:" + gx);
	let gy = BigInt(C.g.y.toString(10));
	//console.log("gy:" + gy);
	let h = 8n;
	let point;
	this.curve = new Curve(a, d, p, n, h, gx, gy);
	
	this.pswd = Buffer.from(lock_password, 'hex');
	console.log("pswd:" + this.pswd);
	
	point = ExtPoint.fromRistrettoHash(this.pswd);
	console.log("point:");
	console.log("\tx:" + point.x);
	console.log("\ty:" + point.y);
	console.log("\tz:" + point.z);
	console.log("\tt:" + point.t);
//	let test1 = point.toX25519();

	let point1 = point.toAffine();
	//point1 = new Point(point1.x, point1.y);
	console.log("point1.toAffine:");
	console.log("\tx:" + point1.x);
	console.log("\ty:" + point1.y);
	console.log("\tz:" + point1.z);
	console.log("\tt:" + point1.t);		
	/*let test2 = point1.toX25519();
	console.log("test1:" + test1);
	console.log("test2:" + test2);*/

	//var Cc = this.hscurve.getCurve('curve25519');
	//let x = point.toX25519(); //Private message point Pm
	//x = x.toString(16);
	//this.Pm = Cc.point(x, '1');
	//console.log("PM:" + this.Pm.x);

/*	point = new Point(point.x, point.y);
	var Cc = this.hscurve.getCurve('ed25519');
	let x = point.x;
	let y = point.y;
	x = x.toString(16);
	y = y.toString(16);
	this.Pm = Cc.point(x, y);
	console.log("PM:" + this.Pm.y);
*/
/*	if (this.Pm.validate()) {
		console.log("this.Pm Valid point on curve");
	}
	else {
		console.log("this.Pm InValid point on curve");
		return;
	}

	let b = new BN('2', 16);
	this.Pm = this.Pm.diffAdd(this.Pm, this.Pm);
	console.log("PM:" + this.Pm.x);
    return instance;*/
};
}());

LockSeed.prototype.getSeed = function (point/*random private point*/, server_pub) {

	if (point.validate()) {
		console.log("Valid point on curve");
	}
	else {
		console.log("InValid point on curve");
		return;
	}

	if (server_pub.validate()) {
		console.log("Valid point on curve");
	}
	else {
		console.log("InValid point on curve");
		return;
	}


	let priv = point.getPrivate('hex');
	console.log("RPV:" + priv);
	let privBN = new BN(priv, 16);

	let pub = point.getPublic('hex');
	let c = this.hscurve.getCurve('curve25519');

	let cipher_point_1 = c.point(pub, '1');;
	console.log("cipher_point_1:" + cipher_point_1.x);

	let cipher_point_2 = server_pub;//server_pub.mul(privBN);
	console.log("cipher_point_2:" + cipher_point_2.x);

	if (cipher_point_2.validate()) {
		console.log("cipher_point_2 valid point on curve");
	}
	else {
		console.log("cipher_point_2 invalid point on curve");
		return;
	}

	let seed = cipher_point_2.add(this.Pm);
	console.log("seed:" + seed);

	if (seed.validate()) {
		console.log("seed valid point on curve");
	}
	else {
		console.log("seed invalid point on curve");
		return;
	}	
}

var lock_seed = new LockSeed();
//let rpp = lock_seed.hscurve.getRandPrivPoint('curve25519');
//lock_seed.getSeed(rpp, PreShared.server_Pb);
module.exports = LockSeed;