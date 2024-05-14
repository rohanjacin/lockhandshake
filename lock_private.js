var BN = require('bn.js');

//change this
let lock_priv = new BN('a3a74b2b196177d205f774ae698612e23c6dbce6c0255edaba1913cff38ccf96', 16);

//change this
var lock_password =
[
'79be667e f9dcbbac 55a06295 ce870b07 029bfcdb 2dce28d9 59f2815b 16f81798',
'483ada77 26a3c465 5da4fbfc 0e1108a8 fd17b448 a6855419 9c47d08f fb10d4b8'
]

let server_lcs = new BN('216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51e', 16);

module.exports.lock_priv = lock_priv;
module.exports.lock_password = lock_password;
module.exports.server_lcs = server_lcs;

//change this
//let lock_priv = new BN('a3a74b2b196177d205f774ae698612e23c6dbce6c0255edaba1913cff38ccf96', 16);
