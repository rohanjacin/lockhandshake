const hotp = require('hotp');
const { hkdf } = require('@panva/hkdf');
var createHash = require( 'crypto' ).createHash;

async function test() {
	let hash = createHash('sha256');
	let shared_secret_lock = 'hello'; 
	let shared_secret_server = 'world'; 

	hash.update(shared_secret_lock);
	hash.update(shared_secret_server);

	let salt = 'guestkey';
	let info = 'info';
	let key = hash.digest('hex')

	console.log("hkdf:", hkdf);
	let shared_key = await hkdf('sha256', key, salt, info, 32);
	console.log("key:" + key);
	console.log("salt:" + salt);
	console.log("info:" + info);
	console.log("typeofshared_key:" + shared_key);

	salt = 'guestmessagingkey';
	info = 'info';

	let shared_msg_key = await hkdf('sha256', key, salt, info, 32);
	console.log("salt:" + salt);
	console.log("info:" + info);
	console.log("shared_msg_key:" + shared_msg_key);

	let pin = hotp(shared_key, 1, {digits: 8});
	console.log("pin:" + pin);

}

test();
