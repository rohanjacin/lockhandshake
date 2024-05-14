const BN = require('bn.js');

let cipherpt1_x = bigint_to_array(64, 4, 1660601034967572673246032198894585646043547055205330066108949751938981624584n);
let cipherpt1_y = bigint_to_array(64, 4, 37576617086430076427698108515780044748308279504194311396563372997663402077424n);
let cipherpt2_x = bigint_to_array(64, 4, 94491367242822732700287982338974044717873101367982572391927676008771904158248n);
let cipherpt2_y = bigint_to_array(64, 4, 53141182055779363306525561346542553774861670229990946834358312921601273368807n);
let pm_x = bigint_to_array(64, 4, 55066263022277343669578718895168534326250603453777594175500187360389116729240n);
let pm_y = bigint_to_array(64, 4, 32670510020758816978083085130507043184471273380659243275938904335757337482424n);

let serverpriv = bigint_to_array(64, 4, 64939159272434080183288747866033515422674862342980487963917511857628795453066n);

console.log("cipherpt1_x:" + cipherpt1_x);
console.log("cipherpt1_y:" + cipherpt1_y);
console.log("cipherpt2_x:" + cipherpt2_x);
console.log("cipherpt2_y:" + cipherpt2_y);
console.log("pm_x:" + pm_x);
console.log("pm_y:" + pm_y);

console.log("serverpriv:" + serverpriv);

function bigint_to_array(n, k, x) {
    let mod = 1n;
    for (var idx = 0; idx < n; idx++) {
        mod = mod * 2n;
    }

    //let ret = new BigInt64Array(k);
    let ret = [];
    var x_temp = BigInt(x);

    for (var idx = 0; idx < k; idx++) {
        ret.push(x_temp % mod);
        x_temp = x_temp / mod;
    }
    return ret;
}