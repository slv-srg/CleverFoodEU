//`̀̀̀̀̀

const path = require('path')
const fs = require('fs')

Date.prototype.getSqlFormat = function () {
  const day = this.getDate()
  const month = this.getMonth() + 1
  return (
    this.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day
  )
}

if (process.argv[2] === undefined) {
  console.log('Set redirect_uri in arguments!')
  process.exit(1)
}
const redirect_uri = process.argv[2]

const AmoCRM = require('amocrm-js')
const crm = new AmoCRM({
  domain: '__CODE_HERE__',
  auth: {
    client_id: '__CODE_HERE__',
    client_secret: '__CODE_HERE__',
    redirect_uri: redirect_uri,
    server: {
      port: 3001,
    },
  },
})

/* Попробуем использовать токен из предыдущей сессии */
try {
  const lastUsedToken = require('./data/token.json')
  const tokenIssued = require('./data/token_issued.json')
  crm.connection.setToken(lastUsedToken, tokenIssued.date)
} catch (e) {
  console.log('Token file not found')
  // Установить соединение
  const url = crm.connection.getAuthUrl()
  console.log(url)
}

crm.on('connection:error', () => console.log('Ошибка соединения'))
crm.on('connection:checkToken', () => console.log('  -> checkToken'))
crm.on('connection:newToken', token => {
  fs.writeFileSync('./data/token_issued.json', JSON.stringify({ date: new Date() }))
  fs.writeFileSync('./data/token.json', JSON.stringify(token.data))
  console.log('  -> newToken')
})

const hlavni_pipeline_id = 3335653
const demo_pipeline_id = 3332665

const crm_status_finished = 142

// https://www.amocrm.ru/developers/content/crm_platform/leads-api
const page = 5
crm.request
  .get('/api/v4/leads', {
    //query: phone,
    //with: 'contacts',
    limit: 250,
    page: page,
    // Сделки на определённом шаге воронки
    filter: {
      statuses: [
        { pipeline_id: hlavni_pipeline_id, status_id: crm_status_finished },
        { pipeline_id: hlavni_pipeline_id, status_id: 33478963 }, // kvalifikace
        { pipeline_id: hlavni_pipeline_id, status_id: 33479020 }, // vyroba
        { pipeline_id: hlavni_pipeline_id, status_id: 33478966 }, // Čeká nebo přerušil
        { pipeline_id: demo_pipeline_id, status_id: crm_status_finished },
        { pipeline_id: demo_pipeline_id, status_id: 33458329 }, // kvalifikace
        { pipeline_id: demo_pipeline_id, status_id: 33458332 }, // vyroba
      ],
    },
  })
  .then(leads => {
    console.log(`Page: ${page}; Total: ${Object.keys(leads.data._embedded.leads).length}`)
    // 27314549 — Bad lead(!) Please skip it.
    leads.data._embedded.leads.forEach(lead => {
      console.log(lead.id)
    })
    console.log(leads.data._embedded.leads.length)
  })
  .catch(e => console.log(e))
