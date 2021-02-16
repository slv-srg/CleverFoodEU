import fs from 'fs';
import AmoCRM from 'amocrm-js';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import pkg from '../tokens/keys.js';

const {
  domain,
  client_id,
  client_secret,
} = pkg;

export default () => {
  if (!process.argv[2]) {
    console.log(process.argv);
    console.log('Set redirect_uri in arguments!');
    process.exit(1);
  }
  
  const crm = new AmoCRM({
    domain,
    auth: {
      client_id,
      client_secret,
      redirect_uri: process.argv[2],
      server: {
        port: 3001,
      },
    },
  });

  try {
    const token = require('../tokens/token.json');
    const tokenIssued = require('../tokens/token_issued.json');
    crm.connection.setToken(token, tokenIssued);
  } catch (e) {
    console.log('Token file not found');
    const url = crm.connection.getAuthUrl();
    console.log(url);
  }
  
  crm.on('connection:error', () => console.log('Ошибка соединения'));
  crm.on('connection:newToken', (newToken) => {
    fs.writeFileSync('./tokens/token_issued.json', JSON.stringify({ date: new Date() }));
    fs.writeFileSync('./tokens/token.json', JSON.stringify(newToken.data));
    console.log('  -> newToken');
  });
  return crm;
};
