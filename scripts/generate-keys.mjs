import {randomBytes} from 'node:crypto';
for(const name of ['BALLOT_ENCRYPTION_KEY','TOKEN_PEPPER','VOTER_PIN_PEPPER','LOGIN_RATE_SECRET','MFA_ENCRYPTION_KEY','ISSUANCE_ENCRYPTION_KEY','ROSTER_PROTECTION_KEY'])console.log(`${name}=${randomBytes(32).toString('hex')}`);
console.log('# Guarde os valores em um cofre de segredos. Perder BALLOT_ENCRYPTION_KEY impede a apuração.');
