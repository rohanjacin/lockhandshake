const elliptic = require('elliptic');
const ec = new elliptic.ec('secp256k1');

let s = ec.genKeyPair();
let priv = s.getPrivate();
let pub = s.getPublic();

console.log("private:" + priv.toString('hex'));
console.log("public.x:" + pub.x.toString('hex'));
console.log("public.y:" + pub.y.toString('hex'));

//server private a3a74b2b196177d205f774ae698612e23c6dbce6c0255edaba1913cff38ccf96
/*const server_pub = [
  '79be667e f9dcbbac 55a06295 ce870b07 029bfcdb 2dce28d9 59f2815b 16f81798',
  '483ada77 26a3c465 5da4fbfc 0e1108a8 fd17b448 a6855419 9c47d08f fb10d4b8'
];*/

//fca7af6578fe0cc9ec73894428032aa458ff0d6d143441ba81ee50a022df4a92

//d7f5ea0b4dcbc0a3cc844e45200c9fbf26d81fac103031080f2aefd15a89b387
//8842e62f0672909331716c78025f834c51d72a0bf32e66f4ab0cce4842d4fcae