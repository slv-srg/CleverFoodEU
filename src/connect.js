import fs from 'fs';
import AmoCRM from 'amocrm-js';
import { createRequire } from "module";
const require = createRequire(import.meta.url);

export default () => {
  if (!process.argv[2]) {
    console.log(process.argv);
    console.log('Set redirect_uri in arguments!');
    process.exit(1);
  }
  
  const redirectUri = process.argv[2];
  
  const crm = new AmoCRM({
    domain: 'infocleverfoodeu.amocrm.ru',
    auth: {
      client_id: 'bec33e82-b66f-4200-b24c-db823c3d6b67',
      client_secret: '1NIhLCyq6TlHjReedIO3CoSLgoQhjrAak847OYYnKYuc1YxShTUUZVSUIUjWAoGi',
      redirect_uri: redirectUri,
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
    fs.writeFileSync('../tokens/token_issued.json', JSON.stringify({ date: new Date() }));
    fs.writeFileSync('../tokens/token.json', JSON.stringify(newToken.data));
    console.log('  -> newToken');
  });
  return crm;
};
