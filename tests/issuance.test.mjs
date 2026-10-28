import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {encryptPinBatch,decryptPinBatch,hashSource,trustedSource} from '../lib/issuance.js';
process.env.ISSUANCE_ENCRYPTION_KEY=randomBytes(32).toString('hex');
process.env.LOGIN_RATE_SECRET=randomBytes(32).toString('hex');
const election=randomUUID(),batch=randomUUID();
test('PINs ficam cifrados com autenticidade e contexto da eleição',()=>{
 const pins=['0000000007','1234567890','9999999999'];
 const payload=encryptPinBatch(batch,election,pins);
 assert(!pins.some(pin=>payload.includes(pin)));
 assert.deepEqual(decryptPinBatch(batch,election,payload),pins);
 assert.throws(()=>decryptPinBatch(randomUUID(),election,payload));
 assert.throws(()=>decryptPinBatch(batch,randomUUID(),payload));
});
test('lote adulterado e PINs inválidos são rejeitados',()=>{
 assert.throws(()=>encryptPinBatch(batch,election,['1']));
 const value=encryptPinBatch(batch,election,['1234567890']);
 const raw=Buffer.from(value,'base64url');raw[20]^=0xff;
 assert.throws(()=>decryptPinBatch(batch,election,raw.toString('base64url')));
});
test('identificador de origem é HMAC, sem persistir IP bruto',()=>{
 const a=hashSource('vercel-ip:203.0.113.1');
 const b=hashSource('vercel-ip:203.0.113.2');
 assert.match(a,/^[0-9a-f]{64}$/); assert.notEqual(a,b);
 assert(!a.includes('203.0.113.1'));
});
test('IP encaminhado é ignorado sem proxy reconhecido',()=>{
 const prev=process.env.VERCEL;delete process.env.VERCEL;
 try {assert.equal(trustedSource({headers:new Headers({'x-forwarded-for':'1.2.3.4'})}),'unidentified-source');}
 finally{if(prev===undefined)delete process.env.VERCEL;else process.env.VERCEL=prev;}
});
test('Vercel fornece IP sem lista de encaminhamento',()=>{
 const prev=process.env.VERCEL;process.env.VERCEL='1';
 try{
  assert.equal(trustedSource({headers:new Headers({'x-forwarded-for':'203.0.113.9'})}),'vercel-ip:203.0.113.9');
  assert.equal(trustedSource({headers:new Headers({'x-forwarded-for':'123.4.5.6, 1.2.3.4'})}),'unidentified-source');
 }finally{if(prev===undefined)delete process.env.VERCEL;else process.env.VERCEL=prev;}
});
