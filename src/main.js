/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-named-as-default */
/* eslint-disable import/no-named-as-default-member */
import moment from 'moment';
import _ from 'lodash';
import connect from './connect.js';
import pkg from './dataset.js';

const {
  // initDate,
  todayDate,
  workDays,
  hlavni,
  demo,
  // zdrave,
  finished,
  firstDatabasePage,
  timecut,
  workDates,
} = pkg;

process.env.TZ = 'Europe/Prague';

const unixTimeToString = (unixTime) => moment(unixTime).format('YYYY-MM-DD');
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

const makeEventsList = async (leadsList) => {
  console.log('makeEventsList FUNCTION is run \n');
  const leadsStat = [];

  const resolveAfterPause = (response) => new Promise((resolve) => {
    setTimeout(() => {
      resolve(response);
    }, 120000);
  });

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
          .catch((error) => console.log(error));
      })
      .catch((error) => console.log(error));
  });
  return resolveAfterPause(leadsStat);
};

const normalizeDates = (leadsStat) => leadsStat.map(([lead, leadStat, contact, dates]) => {
  sort(dates);
  const stringDates = dates.map((date) => unixTimeToString(date));
  return [lead, leadStat, contact, stringDates];
});

const buildWorkDates = (leadsStat) => {
  console.log('buildWorkDates FUNCTION is run \n');
  const dateNormalized = normalizeDates(leadsStat);
  const builded = dateNormalized.map(([lead, leadStat, contact, dates]) => {
    const workingDates = [];
    const chunked = _.chunk(dates, 2);
    let currentDate = '';
    let lastDate = '';
    chunked.forEach(([start, end]) => {
      currentDate = start;
      lastDate = moment(end).add(1, 'day').format('YYYY-MM-DD');
      do {
        if (allTimeWokrDates.includes(currentDate)) {
          workingDates.push(currentDate);
        }
        currentDate = moment(currentDate).add(1, 'day').format('YYYY-MM-DD');
      } while (currentDate !== lastDate && currentDate !== todayDate);
    });
    const uniqWorkingDates = _.uniq(workingDates);
    return [lead, leadStat, contact, uniqWorkingDates];
  });
  console.log('buildWorkDates FUNCTION is finished \n');
  return builded;
};

const makeLeadsList = async (pageNum) => {
  console.log('makeLeadsList FUNCTION is run \n');
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
        if (contact.length === 1) {
          leadsList.push([
            lead.id,
            [lead.status_id, lead.pipeline_id],
            [contact[0].id],
          ]);
        }
        if (contact.length > 1) {
          const contactIds = contact.map((item) => item.id);
          leadsList.push([
            lead.id,
            [lead.status_id, lead.pipeline_id],
            contactIds,
          ]);
        }
      });
    })
    .catch((error) => console.log('ERROR: ', error));
  return leadsList; // delete in prod-version (short test stop)

  // return leadsList.length // uncomment for prod-version
  //   ? [...leadsList, ...(await makeLeadsList(pageNum + 1))] // uncomment for prod-version
  //   : []; // uncomment for prod-version
};

// export default async () => {
//   const leadsList = await makeLeadsList(firstDatabasePage);
//   const eventsList = await makeEventsList(leadsList);
//   const eventsForUpload = await buildWorkDates(eventsList);
//   const customersForUpload = await buildCustomers(eventsForUpload);

//   await customersImportToMixpanel(customersForUpload);
//   await eventsImportToMixpanel(eventsForUpload);
//   console.log(eventsForUpload);
// };

const run = async () => {
  const leadsList = await makeLeadsList(firstDatabasePage);
  const eventsList = await makeEventsList(leadsList);
  const eventsForUpload = await buildWorkDates(eventsList);

  console.log(eventsForUpload);
};

run();
