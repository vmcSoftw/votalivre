import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {registrationFields,secretDigest,isValidSetupToken,validTotpCode,safeCompareCode} from '../lib/registration.js';
const valid={organization:'Escola Modelo',email:' GESTOR@escola.edu.br ',password:'UmaSenhaMuitoLonga2026!',invitation:randomBytes(32).toString('hex')};
test('Cadastro institucional normaliza email e nome sem modificar senha',()=>{
 const fields=registrationFields(valid);
 assert.equal(fields.organization,'Escola Modelo');
 assert.equal(fields.email,'gestor@escola.edu.br');
 assert.equal(fields.password,valid.password);
 assert.equal(fields.invitation,valid.invitation);
});
test('Convite deve conter exatamente 256 bits em hexadecimal',()=>{
 for(const invitation of ['','123','x'.repeat(64),'a'.repeat(63),'a'.repeat(65)])
 assert.throws(()=>registrationFields({...valid,invitation}),/convite/i);
});
test('Convite hexadecimal em maiúsculas é aceito e normalizado',()=>{
 assert.equal(registrationFields({...valid,invitation:valid.invitation.toUpperCase()}).invitation,valid.invitation);
});
test('O cadastro exige senha com pelo menos 16 caracteres',()=>{
 assert.throws(()=>registrationFields({...valid,password:'curta'}),/senha/i);
});
test('O cadastro rejeita senha excessivamente longa',()=>{
 assert.throws(()=>registrationFields({...valid,password:'a'.repeat(1025)}),/senha/i);
});
test('Nome de organização fora dos limites é rejeitado',()=>{
 for(const organization of ['','a','x'.repeat(121)])assert.throws(()=>registrationFields({...valid,organization}),/organização/i);
});
test('E-mail malformado é rejeitado',()=>{
 for(const email of ['sem-arroba','nome@','@dominio.com','a b@dominio.com'])assert.throws(()=>registrationFields({...valid,email}),/e-mail/i);
});
test('Token de confirmação MFA deve ter formato rígido',()=>{
 assert.equal(isValidSetupToken(randomBytes(32).toString('hex')),true);
 assert.equal(isValidSetupToken('abc'),false);
 assert.equal(isValidSetupToken(null),false);
});
test('Confirmação MFA recebe só seis dígitos',()=>{
 assert.equal(validTotpCode('000123'),true);
 for(const input of ['1','1234567','12345a',null])assert.equal(validTotpCode(input),false);
});
test('O código de convite é transformado em hash, não armazenado em claro',()=>{
 assert.match(secretDigest(valid.invitation),/^[a-f0-9]{64}$/);
 assert.notEqual(secretDigest(valid.invitation),valid.invitation);
});
test('Comparação segura rejeita formato inválido e código divergente',()=>{
 assert.equal(safeCompareCode(valid.invitation,valid.invitation),true);
 assert.equal(safeCompareCode(valid.invitation,randomBytes(32).toString('hex')),false);
 assert.equal(safeCompareCode('não é código',valid.invitation),false);
});
