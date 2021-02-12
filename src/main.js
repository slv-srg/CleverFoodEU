/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-named-as-default */
/* eslint-disable import/no-named-as-default-member */
import moment from 'moment';
import connect from './connect.js';
import pkg from './dataset.js';

const {
  initDate,
  // todayDate,
  // workDates,
} = pkg;

process.env.TZ = 'Europe/Prague';

// const unixTimeToString = (ut) => moment(ut).format().slice(0, 10);
const stringToUnixTime = (dateStr) => moment(dateStr).format('X');

const crm = connect();

const maxPageEntriesQty100 = 100;
const maxPageEntriesQty250 = 5; // prod value: 250
const firstDatabasePage = 1;

const finished = 142;

const hlavni = {
  id: 3335653,
  qlf: 33478963,
  prod: 33479020,
  hold: 33478966,
};

const zdrave = {
  id: 1425106,
  prod: 22328251,
};

const demo = {
  id: 3332665,
  qlf: 33458329,
  prod: 33458332,
};

const statuses = [
  { pipeline_id: hlavni.id, status_id: finished },
  { pipeline_id: hlavni.id, status_id: hlavni.qlf },
  { pipeline_id: hlavni.id, status_id: hlavni.prod },
  { pipeline_id: hlavni.id, status_id: hlavni.hold },
  { pipeline_id: demo.id, status_id: finished },
  { pipeline_id: demo.id, status_id: demo.qlf },
  { pipeline_id: demo.id, status_id: demo.prod },
];

const leadList = [];

const makeRow = async () => {
  const result = {
    customers: {},
  };
  const { customers } = result;

  leadList.forEach(async (lead) => {
    const [leadId, createDate, closeDate] = lead;
    await crm.request
      .get(`/api/v4/leads/${leadId}`, {
        with: 'contacts',
      })
      .then(({ data }) => {
        const { _embedded } = data;
        const { contacts } = _embedded;
        const [{ id }] = contacts;
        // console.log(id, leadId); // to ss-ll match
        customers[id] = {
          leads: {
            [leadId]: {
              initDates: [createDate, closeDate],
              prodDates: [],
            },
          },
        };
        // console.log(JSON.stringify(result));
      });

    await crm.request
      .get('/api/v4/events', {
        limit: maxPageEntriesQty100,
        page: firstDatabasePage,
        filter: {
          entity: 'lead',
          entity_id: [leadId],
          created_at: stringToUnixTime(initDate),
          value_after: {
            leads_statuses: [
              {
                pipeline_id: hlavni.id,
                status_id: hlavni.prod,
              },
              {
                pipeline_id: zdrave.id,
                status_id: zdrave.prod,
              },
              {
                pipeline_id: demo.id,
                status_id: demo.prod,
              },
            ],
          },
        },
      })
      .then(({ data }) => {
        console.log('Вот пошел контент:', data._embedded);
      });
  });
};

const iter = async (counter) => {
  // if (counter === 2) return; // --> short stop / should be deleted in prod
  let actualPageLength = 0;
  await crm.request
    .get('/api/v4/leads', {
      limit: maxPageEntriesQty250,
      page: counter,
      filter: {
        statuses,
      },
    })
    .then(({ data }) => {
      const { _embedded } = data;
      const { leads } = _embedded;
      actualPageLength = leads.length;
      leads.forEach((lead) => {
        leadList.push([
          lead.id,
          lead.created_at * 1000,
          lead.closed_at * 1000,
        ]);
        // console.log(leadList);
      });
    })
    .catch((e) => console.log(e));
  if (counter < 2) iter(counter + 1); // --> short stop / should be deleted in prod
  // if (actualPageLength === pageLimit250) iter(counter + 1); // uncommit for prod version
  else {
    makeRow();
  }
};

iter(firstDatabasePage);
