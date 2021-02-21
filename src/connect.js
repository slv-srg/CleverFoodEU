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
    crm.connection.setToken(token);
    // crm.connection.refreshToken();
  } catch (e) {
    console.log('Please open this URL in browser and confirm the access.');
    console.log(crm.connection.getAuthUrl());
  }

  crm.on('connection:beforeRefreshToken', () => console.log('beforeRefreshToken'));

  crm.on('connection:error', () => console.log('Ошибка соединения'));
  crm.on('connection:newToken', (newToken) => {
    console.log('connection:newToken')
    fs.writeFileSync('./tokens/token.json', JSON.stringify(newToken.data));
  });
  return crm;
};
