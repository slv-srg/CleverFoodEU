//`
process.env.TZ = 'Europe/Prague'

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
//crm.on('connection:checkToken', () => console.log('  -> checkToken'))
crm.on('connection:newToken', token => {
  fs.writeFileSync('./data/token_issued.json', JSON.stringify({ date: new Date() }))
  fs.writeFileSync('./data/token.json', JSON.stringify(token.data))
  console.log('  -> newToken')
})

/* *********************** */

const timecut = '13:30'
// Создаёт массив всех дней, в которых, в ${timecut} сделка была в данном шаге воронки
// Тут должен былть пример...
function findDates(begin, end) {
  const begin_date = new Date(begin * 1000)
  const today_noon = new Date(`${begin_date.getSqlFormat()} ${timecut}`).getTime() / 1000
  const today_active = []
  // Если время попадания сделки на шаг воронки меньше 12-ти дня...
  // ... нужно проверить конец интервала
  if (begin < today_noon && end > today_noon) {
    // Да, в 12 часов begin дня сделка тут
    today_active.push(today_noon)
  }

  // Если время попадания сделки на шаг воронки - после 12-ти,
  // то переходим к следующему дню

  // Если возможно - проверяем следующий день
  begin_date.setDate(begin_date.getDate() + 1)
  const next_day = new Date(`${begin_date.getSqlFormat()} 00:01`).getTime() / 1000
  if (next_day < end) {
    return [...today_active, ...findDates(next_day, end)]
  }

  return today_active
}

// Получить все сделки шага
const crm_pipeline_id = 3335653
const crm_status_vyroba = 33479020
const crm_status_finished = 142

// 03/05/2020
const first_date = 1588539600 // Дата первой подписки

// https://www.amocrm.ru/developers/content/crm_platform/leads-api
// https://www.amocrm.ru/developers/content/crm_platform/events-and-notes
const page = 1
// const lead_id = 28327245
//const lead_id = 28181931
const lead_id = 25965477
// const lead_id = 25536871 // Первая сделка — другая воронка
// const lead_id = 26080045

function get_row(lead_id) {
  const contact = { id: 0 }
  const row = []
  crm.request
    .get(`/api/v4/leads/${lead_id}`, {
      with: 'contacts',
    })
    .then(lead => {
      row.push(lead.data._embedded.contacts[0].id)
      row.push(`,${lead_id},0`)

      crm.request
        .get('/api/v4/events', {
          limit: 250,
          page: page,
          filter: {
            entity: 'lead',
            entity_id: [lead_id],
            created_at: first_date,
            value_after: {
              leads_statuses: [
                {
                  pipeline_id: crm_pipeline_id,
                  status_id: crm_status_vyroba,
                },
                {
                  pipeline_id: 1425106,
                  status_id: 22328251,
                },
                {
                  pipeline_id: 3332665,
                  status_id: 33458332,
                },
              ],
            },
          },
        })
        .then(leads => {
          if (undefined === leads.data) {
            console.log('NO "value_after" DATA for lead_id=' + lead_id)
            return
          }
          if (leads.data.errors !== undefined) {
            console.log('ERROR: ' + leads.data.title + ' | ' + leads.data.detail)
          }
          console.log(`Page: ${page}; Total: ${Object.keys(leads.data._embedded.events).length}`)

          const after = leads.data._embedded.events.reduce(
            (acc, event) => [event.created_at, ...acc],
            []
          )
          // console.log('AFTER') // сделка перешла в статус crm_status_vyroba
          // after.forEach(created_at => {
          //   const d = new Date(created_at * 1000)
          //   console.log(created_at + ': ' + d.getSqlFormat() + ' ' + d.getHours() + ':' + d.getMinutes())
          // })

          crm.request
            .get('/api/v4/events', {
              limit: 250,
              page: page,
              filter: {
                entity: 'lead',
                entity_id: [lead_id],
                created_at: after[0],
                value_before: {
                  leads_statuses: [
                    {
                      pipeline_id: crm_pipeline_id,
                      status_id: crm_status_vyroba,
                    },
                    {
                      pipeline_id: 1425106,
                      status_id: 22328251,
                    },
                    {
                      pipeline_id: 3332665,
                      status_id: 33458332,
                    },
                  ],
                },
              },
            })
            .then(leads => {
              const before = (function (leads_data) {
                if (undefined === leads_data) return [Math.floor(Date.now() / 1000)]

                if (undefined !== leads_data.errors)
                  console.log('ERROR: ' + leads_data.title + ' | ' + leads_data.detail)

                return leads_data._embedded.events.reduce(
                  (acc, event) => [event.created_at, ...acc],
                  []
                )
              })(leads.data)
              // Если сделка сейчас активна - т.е. в статусе vyroba
              // поставим закрывающую дату = сегодня
              if (after.length > before.length) {
                before.push(Math.floor(Date.now() / 1000))
              }

              // Объединили и сортировали по возрастанию
              const res = [...after, ...before].sort((a, b) => a - b)

              // Делаем пары
              const pairs = []
              for (let i = 0; i < after.length; i++) {
                pairs.push([res[i * 2], res[i * 2 + 1]])
              }

              const start = { date: first_date } // Дата первой подписки

              pairs.forEach(vyroba => {
                const dates = findDates(...vyroba)

                if (dates.length > 0) {
                  try {
                    row.push(
                      ',0'.repeat(Math.floor((dates[0] - start.date) / 86400)) +
                        ',1'.repeat(dates.length)
                    )
                  } catch (e) {
                    console.log(e)
                  }
                  // Прибавит день - чтобы текущий не пошёл в расчёт
                  start.date = dates[dates.length - 1] + 86400
                }
              })
              console.log(row.join(''))
            })
          // leads.data._embedded.events.forEach(event => {
          //   const d = new Date(event.created_at * 1000)
          //   console.log(d.getSqlFormat() + ' ' + d.getHours() + ':' + d.getMinutes())
          // })
        })
        .catch(e => console.log(e))
    })
    .catch(e => console.log(e))

  return
}

const arr = fs.readFileSync('csv_leads.csv', 'utf8').split('\n')
arr.pop()
arr.forEach(lid => get_row(lid))
