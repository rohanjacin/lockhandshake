var BN = require('bn.js');
const server_pub = [
  'd7f5ea0b4dcbc0a3cc844e45200c9fbf26d81fac103031080f2aefd15a89b387',
  '8842e62f0672909331716c78025f834c51d72a0bf32e66f4ab0cce4842d4fcae'
];

const server_address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const elliptic = require('elliptic');
const ec = new elliptic.ec('secp256k1');
const server_Pb = ec.curve.point(server_pub[0], server_pub[1]);
const shared_key = '26954ccdc99ebf34f8f1dde5e6bb080685fec73640494c28f9fe0bfa8c794543';
let lock_signature = new BN('216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51e', 16);
let server_signature = new BN('216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51e', 16);

module.exports.server_Pb = server_Pb;
module.exports.shared_key = shared_key;
module.exports.lock_signature = lock_signature;
module.exports.server_signature = server_signature;
module.exports.server_address = server_address;