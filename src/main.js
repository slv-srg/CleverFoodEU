/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-named-as-default */
/* eslint-disable import/no-named-as-default-member */
import _ from 'lodash';
import moment from 'moment-timezone';
import connect from './connect.js';
import pkg from './dataset.js';

moment.tz.setDefault('Europe/Prague');

const {
  workDays,
  hlavni,
  demo,
  // zdrave,
  finished,
  firstDatabasePage,
  startingTimecut,
  stoppingTimecut,
  timecutsSpread,
} = pkg;

const stageChangeQuery = {
  leads_statuses: [
    { pipeline_id: hlavni.id, status_id: hlavni.prod },
    { pipeline_id: demo.id, status_id: demo.prod },
    // { pipeline_id: zdrave.id, status_id: zdrave.prod },
  ],
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

const todayEndingTimestamp = moment({ hour: 23, minute: 59, seconds: 59 }).format('X') * 1000;
const dateToString = (timestamp) => moment(timestamp).format('YYYY-MM-DD');
const dateToWeekday = (timestamp) => moment(timestamp).format('dddd');
const dateToTime = (timestamp) => moment(timestamp).format('HH:mm');
const datePlusOneDay = (timestamp) => moment(timestamp).add(1, 'day');

const crm = connect();

const addLeadsStats = async (firstPageNum) => {
  console.log('addLeadsStats FUNCTION is run \n');
  const statsWithLeads = [];
  await crm.request
    .get('/api/v4/leads', {
      page: firstPageNum,
      limit: 30,
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
          statsWithLeads.push(
            {
              lead: {
                lead_id: lead.id,
                created_at: lead.created_at * 1000,
                status_id: lead.status_id,
                pipeline_id: lead.pipeline_id,
              },
              customer: {
                customer_id: [contact[0].id],
              },
            },
          );
        }
        if (contact.length > 1) {
          const contactIds = contact.map((item) => item.id);
          statsWithLeads.push(
            {
              lead: {
                lead_id: lead.id,
                created_at: lead.created_at * 1000,
                status_id: lead.status_id,
                pipeline_id: lead.pipeline_id,
              },
              customer: {
                customer_id: contactIds,
              },
            },
          );
        }
      });
    })
    .catch((error) => console.log('ERROR: ', error));
  return statsWithLeads; // delete in prod-version (short test stop)

  // return statsWithLeads.length // uncomment for prod-version
  //   ? [...statsWithLeads, ...(await addLeadsStats(firstPageNum + 1))] // uncomment
  //   : []; // uncomment for prod-version
};

const addCustomersStats = async (statsWithLeads) => {
  console.log('addCustomersStats FUNCTION is run \n');
  const statsWithCustomers = [...statsWithLeads];
  statsWithCustomers.forEach(async (item) => {
    const { customer } = item;
    const { customer_id: customerId } = customer;
    const [id] = customerId;

    await crm.request
      .get(`/api/v4/contacts/${id}`, {
        with: 'contacts',
      })
      .then(({ data }) => {
        const [firstName, lastName] = _.split(data.name, ' ');
        customer.first_name = firstName;
        customer.last_name = lastName || 'unknown';

        const { custom_fields_values: fields } = data;
        if (!fields) return;

        fields.forEach((field) => {
          const { field_id: fieldId } = field;
          const [value] = field.values;
          switch (fieldId) {
            case 265795:
              customer.email = value.value;
              break;
            case 265793:
              customer.phone = value.value;
              break;
            case 470187:
              customer.address = value.value;
              break;
            default:
              break;
          }
        });
      })
      .catch((error) => console.log('ERROR: ', error));
  });
  return statsWithCustomers;
};

const addEventsStats = async (statsWithCustomers) => {
  console.log('addEventsStats FUNCTION is run \n');
  const statsWithEvents = [...statsWithCustomers];

  const returnResultAfterPause = (response) => new Promise((resolve) => {
    setTimeout(() => {
      resolve(_.filter(response, 'lead.event_dates'));
    }, 25000);
  });

  statsWithEvents.forEach(async (statItem) => {
    const { lead } = statItem;
    const { lead_id: id } = lead;
    const datesStat = [];

    await crm.request
      .get('/api/v4/events', {
        filter: {
          entity: 'lead',
          entity_id: id,
          type: 'lead_status_changed',
          value_after: stageChangeQuery,
        },
      })
      .then(async ({ data }) => {
        if (!data) return;
        const { _embedded } = data;
        const { events } = _embedded;
        events.forEach((event) => datesStat.push(moment(event.created_at * 1000).tz('Europe/Prague')));

        await crm.request
          .get('/api/v4/events', {
            filter: {
              entity: 'lead',
              entity_id: id,
              type: 'lead_status_changed',
              value_before: stageChangeQuery,
            },
          })
          .then(({ data: $data }) => {
            if (!$data || !$data._embedded) return;
            const { _embedded: $embedded } = $data;
            const { events: $events } = $embedded;
            $events.forEach((event) => datesStat.push(moment(event.created_at * 1000).tz('Europe/Prague')));
            lead.event_dates = datesStat;
          })
          .catch((error) => console.log(error));
      })
      .catch((error) => console.log(error));
  });
  return returnResultAfterPause(statsWithEvents);
};

const buildWorkDates = (chunked) => {
  const [begin] = chunked;
  let end = '';
  if (chunked[1]) {
    [, end] = chunked;
  } else {
    end = todayEndingTimestamp;
  }

  const iter = (newBegin) => {
    const workDates = [];
    if (dateToString(newBegin) >= dateToString(end)) {
      if (dateToTime(end) > stoppingTimecut) {
        // next directive with 'timecutsSpread' does filter the cases when
        // vyroba was set up and cancel during some seconds or a couple of minutes
        if (moment(end) - moment(begin) > timecutsSpread) { // link to 'begin' is correct
          if (workDays.includes(dateToWeekday(newBegin))) {
            workDates.push(dateToString(newBegin));
          } else {
            return workDates;
          }
        }
      } else {
        return workDates;
      }
      // this directive fixes the problem of doubled last working dates
      return workDates;
    }
    if (dateToString(newBegin) === dateToString(begin)) {
      if (dateToTime(newBegin) < startingTimecut) {
        if (workDays.includes(dateToWeekday(newBegin))) {
          workDates.push(dateToString(newBegin));
        }
      }
    } else if (dateToString(newBegin) > dateToString(begin)) {
      if (workDays.includes(dateToWeekday(newBegin))) {
        workDates.push(dateToString(newBegin));
      }
    }
    const nextNewBegin = datePlusOneDay(newBegin);
    return [...workDates, ...iter(nextNewBegin)];
  };

  const result = iter(begin);
  return result;
};

const addWorkDatesStats = (statsWithEvents) => {
  console.log('addWorkDatesStats FUNCTION is run \n');
  const statsWithWorkDates = [...statsWithEvents];

  statsWithWorkDates.forEach((item) => {
    const { lead } = item;
    const { event_dates: events } = lead;
    events.sort((a, b) => a - b);
    const chunkedDates = _.chunk(events, 2);
    const workDates = [];

    chunkedDates.forEach((chunked) => {
      const result = buildWorkDates(chunked);
      workDates.push(...result);
    });
    lead.work_dates = workDates;
  });
  // NEXT comment block does only print the result of this function

  // statsWithWorkDates.forEach((item) => {
  //   const { lead } = item;
  //   const { event_dates, work_dates } = lead;
  //   console.log('lead id: ', lead.lead_id);
  //   console.log('events dates: ', event_dates);
  //   console.log('work dates: ', work_dates);
  // });
  return statsWithWorkDates;
};

const run = async () => {
  const statsWithLeads = await addLeadsStats(firstDatabasePage);
  if (statsWithLeads.length === 0) return;
  // console.log('RETURNED statsWithLeads: ', statsWithLeads);
  const statsWithCustomers = await addCustomersStats(statsWithLeads);
  // console.log('RETURNED statsWithCustomers: ', statsWithCustomers);
  const statsWithEvents = await addEventsStats(statsWithCustomers);
  // console.log('RETURNED statsWithEvents: ', statsWithEvents);
  const statsWithWorkDates = await addWorkDatesStats(statsWithEvents);
  console.log('RETURNED statsWithWorkDates: ', statsWithWorkDates);
};

run();
