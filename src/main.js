/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-named-as-default */
/* eslint-disable import/no-named-as-default-member */
// import fs from 'fs';
import moment from 'moment';
// import schedule from 'node-schedule';
import _ from 'lodash';
import connect from './connect.js';
import pkg from './dataset.js';

const {
  // initDate,
  todayDate,
  workDates,
  hlavni,
  demo,
  // zdrave,
  finished,
} = pkg;

process.env.TZ = 'Europe/Prague';

const unixTimeToString = (unixTime) => moment(unixTime).format().slice(0, 10);
// const stringToUnixTime = (dateStr) => moment(dateStr).format('X');
const sort = (array) => array.sort((a, b) => a - b);
const crm = connect();

const statuses = [
  { pipeline_id: hlavni.id, status_id: finished },
  { pipeline_id: hlavni.id, status_id: hlavni.qlf },
  { pipeline_id: hlavni.id, status_id: hlavni.prod },
  { pipeline_id: hlavni.id, status_id: hlavni.hold },
  { pipeline_id: demo.id, status_id: finished },
  { pipeline_id: demo.id, status_id: demo.qlf },
  { pipeline_id: demo.id, status_id: demo.prod },
];

const stageChangeQuery = {
  leads_statuses: [
    {
      pipeline_id: hlavni.id,
      status_id: hlavni.prod,
    },
    {
      pipeline_id: demo.id,
      status_id: demo.prod,
    },
    // {
    //   pipeline_id: zdrave.id,
    //   status_id: zdrave.prod,
    // },
  ],
};
const allTimeWokrDates = workDates();
const firstDatabasePage = 1;

const makeEventsList = async (leadsList) => {
  console.log('makeEventsList FUNCTION is run \n');
  console.log('makeEventsList args: ', leadsList);
  const leadsStat = [];

  await leadsList.forEach(async (lead) => {
    const [leadId] = lead;
    const stageDatesStat = [];

    await crm.request
      .get('/api/v4/events', {
        filter: {
          entity: 'lead',
          entity_id: [leadId],
          type: 'lead_status_changed',
          value_after: stageChangeQuery,
        },
      })
      .then(async ({ data }) => {
        if (!data) return;
        const { _embedded } = data;
        const { events } = _embedded;
        events.forEach((event) => stageDatesStat.push(event.created_at * 1000));

        await crm.request
          .get('/api/v4/events', {
            filter: {
              entity: 'lead',
              entity_id: [leadId],
              type: 'lead_status_changed',
              value_before: stageChangeQuery,
            },
          })
          .then(({ data: $data }) => {
            if (!$data) return;
            const { _embedded: $embedded } = $data;
            const { events: $events } = $embedded;
            $events.forEach((event) => stageDatesStat.push(event.created_at * 1000));
            leadsStat.push([...lead, stageDatesStat]);
          })
          // .then(() => fs.writeFileSync('./eventsList.text', JSON.stringify(leadsStat), 'utf-8'))
          // .then(() => console.log('File is written'))
          .catch((error) => console.log(error));
      })
      .catch((error) => console.log(error));
  });
  return leadsStat;
};

const normalizeDates = (leadsStat) => leadsStat.map(([lead, contact, dates]) => {
  sort(dates);
  const stringDates = dates.map((date) => unixTimeToString(date));
  return [lead, contact, stringDates];
});

const buildWorkDates = (leadsStat) => {
  console.log('buildWorkDates FUNCTION is run \n');
  console.log('buildWorkDates args: ', leadsStat);
  // const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const dateNormalized = normalizeDates(leadsStat);
  console.log('normalizeDates FUNCTION is finished \n');
  console.log('normalizeDates return: ', dateNormalized);
  const builded = dateNormalized.map(([lead, contact, dates]) => {
    const workingDates = [];
    const chunked = _.chunk(dates, 2);
    let currentDate = '';
    let lastDate = '';
    chunked.forEach(([start, end]) => {
      currentDate = start;
      lastDate = moment(end).add(1, 'day').format().slice(0, 10);
      do {
        if (allTimeWokrDates.includes(currentDate)) {
          workingDates.push(currentDate);
        }
        currentDate = moment(currentDate).add(1, 'day').format().slice(0, 10);
      } while (currentDate !== lastDate && currentDate !== todayDate);
    });
    return [lead, contact, workingDates];
  });
  console.log('buildWorkDates FUNCTION is finished \n');
  console.log('builded ADS: ', builded);
  return builded;
};

const makeLeadsList = async (pageNum) => {
  const leadsList = [];
  await crm.request
    .get('/api/v4/leads', {
      page: pageNum,
      limit: 250,
      with: 'contacts',
      filter: {
        statuses,
      },
    })
    .then(({ data }) => {
      if (!data) return;
      const { _embedded } = data;
      const { leads } = _embedded;
      leads.forEach((lead) => {
        const { _embedded: embedded } = lead;
        const { contacts: contact } = embedded;
        if (contact.length === 1) leadsList.push([lead.id, [contact[0].id]]);
        if (contact.length > 1) {
          const contactIds = contact.map((item) => item.id);
          leadsList.push([lead.id, contactIds]);
        }
      });
    })
    .catch((error) => console.log('ERROR: ', error));
  return leadsList; // delete in prod-version (short test stop)
  // return leadsList.length // uncomment for prod-version
  //   ? [...leadsList, ...(await makeLeadsList(pageNum + 1))] : []; // uncomment for prod-version
};

const run = async () => {
  const leadsList = await makeLeadsList(firstDatabasePage);
  const eventsList = await makeEventsList(leadsList);
  const dataForUpload = await buildWorkDates(eventsList);
};

run();

// const rule = new schedule.RecurrenceRule();
// rule.dayOfWeek = [new schedule.Range(0, 5)]; // every Sunday - Friday, 10pm
// rule.hour = 22;
// rule.tz = 'Europe/Prague';

// schedule.scheduleJob(rule, iter(firstDatabasePage));
