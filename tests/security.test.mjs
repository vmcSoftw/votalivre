import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {makeToken,makeReceipt,makeVoterPin,voterPinDigest,tokenDigest,passwordHash,verifyPassword,encodeBase32,decodeBase32,totp,verifyTotp,encryptChoice,decryptChoice,encryptMfaSecret,decryptMfaSecret} from '../lib/crypto.js';
process.env.MFA_ENCRYPTION_KEY=randomBytes(32).toString('hex');
process.env.TOKEN_PEPPER=randomBytes(32).toString('hex');
process.env.VOTER_PIN_PEPPER=randomBytes(32).toString('hex');
process.env.BALLOT_ENCRYPTION_KEY=randomBytes(32).toString('hex');
const eid='c6a2185d-8888-4acb-91b3-187719491d89';
const oid='76c44b5d-1023-4ca6-a65f-910719491b9c';
test('tokens and receipts are independently random',()=>{
 const a=makeToken(),b=makeToken();assert.notEqual(a,b);assert.ok(a.length>=40);
 assert.notEqual(makeReceipt(),makeReceipt());assert.equal(tokenDigest(a),tokenDigest(a));assert.notEqual(tokenDigest(a),tokenDigest(b));
});
test('AES-GCM decrypts valid encrypted ballot and rejects modification or wrong election',()=>{
 const ciphertext=encryptChoice(eid,oid);assert.notEqual(ciphertext,oid);assert.equal(decryptChoice(eid,ciphertext),oid);
 assert.throws(()=>decryptChoice('c6a2185d-8888-4acb-91b3-187719491d80',ciphertext));
 const bytes=Buffer.from(ciphertext,'base64url');bytes[bytes.length-1]^=3;
 assert.throws(()=>decryptChoice(eid,bytes.toString('base64url')));
});
test('TOTP roundtrip and invalid code',()=>{
 const key=encodeBase32(randomBytes(20));assert.equal(decodeBase32(key).length,20);
 const timestamp=1761556800000;const code=totp(key,timestamp);
 assert.equal(verifyTotp(key,code,timestamp),Math.floor(timestamp/30000));
 assert.equal(verifyTotp(key,'not-code',timestamp),false);
});
test('scrypt password verification',async()=>{
 const hash=await passwordHash('UmaSenhaGrande!12345');
 assert.equal(await verifyPassword('UmaSenhaGrande!12345',hash),true);
 assert.equal(await verifyPassword('OutraSenhaGrande!12345',hash),false);
});

test('MFA secret is encrypted at rest and authenticated',()=>{
 const data=encryptMfaSecret('JBSWY3DPEHPK3PXP');
 assert.notEqual(data,'JBSWY3DPEHPK3PXP');
 assert.equal(decryptMfaSecret(data),'JBSWY3DPEHPK3PXP');
 const changed=Buffer.from(data,'base64url');changed[changed.length-1]^=1;
 assert.throws(()=>decryptMfaSecret(changed.toString('base64url')));
});

test('Confirmação por código individual é aleatória e isolada por credencial e eleição',()=>{
 const token=makeToken(),pin=makeVoterPin();
 assert.match(pin,/^[0-9]{10}$/);
 assert.equal(voterPinDigest(eid,token,pin),voterPinDigest(eid,token,pin));
 assert.notEqual(voterPinDigest(eid,token,pin),voterPinDigest(eid,makeToken(),pin));
 assert.notEqual(voterPinDigest(eid,token,pin),voterPinDigest('c6a2185d-8888-4acb-91b3-187719491d80',token,pin));
 assert.throws(()=>voterPinDigest(eid,token,'123'),/inválido/);
});
