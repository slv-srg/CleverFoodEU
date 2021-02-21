/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-named-as-default */
/* eslint-disable import/no-named-as-default-member */
import _ from 'lodash';
import moment from 'moment-timezone';
import Mixpanel from 'mixpanel';
import connect from './connect.js';
import pkg from './dataset.js';

moment.tz.setDefault('Europe/Prague');

const mixpanelToken = '58fb55846efbb073ccaeeb7d8512f392';
const mixpanelSecret = 'd6138ec5d2e33e1c609d9a28be4bf5f2';
const mixpanelImporter = Mixpanel.init(
  mixpanelToken,
  {
    secret: mixpanelSecret,
    debug: true,
    verbose: true,
  },
);

const {
  workDays,
  hlavni,
  demo,
  // zdrave,
  contactsFieldsId,
  funnels,
  finished,
  firstDatabasePage,
  startingTimecut,
  stoppingTimecut,
  eventsTimeGap,
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
const dateToTimestamp = (date) => moment(date).format('X') * 1000;

const crm = connect();

const addLeadsStats = async (firstPageNum) => {
  console.log('addLeadsStats FUNCTION is run \n');
  const statsWithLeads = [];
  await crm.request
    .get('/api/v4/leads', {
      page: firstPageNum,
      limit: 250,
      with: 'contacts',
      filter: {
        statuses,
      },
    })
    .then(({ data }) => {
      if (data.status === 401) {
        console.log(`${data.title}: ${data.detail}`);
        process.exit(0);
      }
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
    .catch((error) => console.log('There is an Error: ', error));
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
            case contactsFieldsId.email:
              customer.email = value.value;
              break;
            case contactsFieldsId.phone:
              customer.phone = value.value;
              break;
            case contactsFieldsId.address:
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
    }, 250000);
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
        // next directive with 'eventsTimeGap' does excluded
        //  the pair of the two nearest events if
        // there is less then 5 minutes gap between them
        if (moment(end) - moment(begin) > eventsTimeGap) { // link to 'begin' is correct!
          if (workDays.includes(dateToWeekday(newBegin))) {
            workDates.push(dateToString(newBegin));
          } else {
            return workDates;
          }
        }
      } else {
        return workDates;
      }
      // this directive fixes the problem of doubled final working dates
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
  return statsWithWorkDates;
};

const customersUniquify = (collection) => {
  const unifiedColl = [];

  collection.forEach(({ lead, customer }) => {
    const lastProductionDate = _.last(lead.work_dates) || null;
    const [id] = customer.customer_id;

    if (_.some(unifiedColl, ['id', id])) {
      const foundCustomer = _.find(unifiedColl, ['id', id]);
      if (foundCustomer.last_date < lastProductionDate) {
        foundCustomer.last_date = lastProductionDate;
      }
    } else {
      unifiedColl.push(
        {
          id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone: customer.phone,
          last_date: lastProductionDate,
        },
      );
    }
  });
  return unifiedColl;
};

const importUsers = (collection) => {
  const unifiedColl = customersUniquify(collection);
  console.log(unifiedColl);
  unifiedColl.forEach((customer) => {
    mixpanelImporter.people.set(customer.id, {
      $first_name: customer.first_name,
      $last_name: customer.last_name,
      $email: customer.email,
      $phone: customer.phone,
      _last_date: customer.last_date,
    });
  });
};

const splitLeadsToEvents = (collection) => {
  const splitedEvents = [];
  collection.forEach(({ lead, customer }) => {
    const { work_dates: dates } = lead;

    dates.forEach((date) => {
      const pipeline = _.findKey(funnels, (item) => item.id === lead.pipeline_id);
      const LeadStatus = _.head(_.flatten(_.filter(_.toPairs(funnels[pipeline]),
        ([, value]) => value === lead.status_id)));

      splitedEvents.push({
        event: 'Vyroba',
        properties: {
          distinct_id: customer.customer_id[0],
          time: dateToTimestamp(date),
          lead_id: lead.lead_id,
          pipeline,
          lead_status: LeadStatus,
        },
      });
    });
  });
  return splitedEvents;
};

const importEvents = (collection) => {
  const splitedEvents = splitLeadsToEvents(collection);
  mixpanelImporter.import_batch(splitedEvents);
};

const run = async () => {
  // Do it only once
  // mixpanelImporter.track('Vyroba', { lead_id: 0, pipeline: '', status: 0 });

  const statsWithLeads = await addLeadsStats(firstDatabasePage);
  if (statsWithLeads.length === 0) return;
  const statsWithCustomers = await addCustomersStats(statsWithLeads);
  const statsWithEvents = await addEventsStats(statsWithCustomers);
  const statsWithWorkDates = addWorkDatesStats(statsWithEvents);
  console.log('RETURNED statsWithLeads: ', statsWithWorkDates.length);
  importUsers(statsWithWorkDates);
  importEvents(statsWithWorkDates);
};

run();
