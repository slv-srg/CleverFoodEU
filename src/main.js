/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-named-as-default */
/* eslint-disable import/no-named-as-default-member */
// import fs from 'fs';
import _ from 'lodash';
import moment from 'moment-timezone';
import Mixpanel from 'mixpanel';
import connect from './connect.js';
import pkg from './dataset.js';

moment.tz.setDefault('Europe/Prague');

const mixpanelToken = '7b184de3a539712512c6fd88786acd5b';
const mixpanelSecret = 'eebcc5471d10362bc9e5b53a6d82452c';
const mixpanelImporter = Mixpanel.init(
  mixpanelToken,
  {
    secret: mixpanelSecret,
    debug: true,
    verbose: true,
  },
);

const {
  databasePage,
  pageLimit,
  timeout,
  workDays,
  hlavni,
  demo,
  // zdrave,
  contactsFieldsId,
  funnels,
  finished,
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

// const now = moment().format('YYYY-MM-DD');
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
      limit: pageLimit,
      with: 'contacts',
      filter: {
        statuses,
      },
    })
    .then(({ data }) => {
      if (!data) return;
      if (data.status === 401) {
        console.log(`${data.title}: ${data.detail}`);
        process.exit(0);
      }
      const { _embedded } = data;
      const { leads } = _embedded;

      leads.forEach((lead) => {
        const { _embedded: embedded } = lead;
        const { contacts: contact } = embedded;
        let customerId = 0;
        if (!contact.length) return;
        if (contact.length === 1) customerId = [contact[0].id];
        if (contact.length > 1) customerId = contact.map((item) => item.id);

        statsWithLeads.push(
          {
            lead: {
              lead_id: lead.id,
              created_at: lead.created_at * 1000,
              status_id: lead.status_id,
              pipeline_id: lead.pipeline_id,
            },
            customer: {
              customer_id: customerId,
            },
          },
        );
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
    }, timeout);
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
        if (!data || !data._embedded) return;
        console.log('data 1st cycle + lead_id: ', data, id);
        const { _embedded } = data;
        const { events } = _embedded;
        console.log('events 1st cycle: ', events);
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
            if ($data) {
              const { _embedded: $embedded } = $data;
              const { events: $events } = $embedded;
              $events.forEach((event) => datesStat.push(moment(event.created_at * 1000).tz('Europe/Prague')));
            }
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

  unifiedColl.forEach((customer) => {
    const fullName = customer.last_name !== 'unknown'
      ? `${customer.first_name} ${customer.last_name}`
      : `${customer.first_name}`;

    mixpanelImporter.people.set(customer.id, {
      _id: customer.id,
      $first_name: customer.first_name,
      $last_name: customer.last_name,
      _full_name: fullName,
      $email: customer.email,
      $phone: customer.phone,
      _last_date: customer.last_date,
    });
  });
  console.log('Stats of Users for Import: ', unifiedColl.length, '\n');

  // ------ DUMP ------
  // let csvUnifiedColl = 'id,first_name,last_name,email,phone,last_date\n';
  // unifiedColl.forEach((item) => {
  //   csvUnifiedColl += `${item.id},${item.first_name},${item.last_name},${item.email},${item.phone},${item.last_date}\n`;
  // });
  // fs.writeFile(`./temp/dump/users_page-${databasePage}_${now}.csv`, csvUnifiedColl, (error) => {
  //   if (error) throw new Error(error);
  //   console.log('Success with Users writing.');
  // });
};

const splitLeadsToEvents = (collection) => {
  const splitedEvents = [];
  collection.forEach(({ lead, customer }) => {
    const { work_dates: dates } = lead;

    dates.forEach((date) => {
      const pipeline = _.findKey(funnels, (item) => item.id === lead.pipeline_id);
      const LeadStatus = _.head(
        _.flatten(
          _.filter(
            _.toPairs(funnels[pipeline]),
            ([, value]) => value === lead.status_id,
          ),
        ),
      );

      splitedEvents.push({
        event: 'Vyroba',
        properties: {
          $insert_id: `${lead.lead_id}-${date}`, // uniq event id
          distinct_id: customer.customer_id[0],
          // time: date, // test property
          time: dateToTimestamp(date), // prod property
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
  console.log('Stats of Splited Events for Import: ', splitedEvents.length, '\n');
  mixpanelImporter.import_batch(splitedEvents);

  // ------ DUMP ------
  // let csvSplitedEvents = 'distinct_id,time,lead_id,pipeline,lead_status\n';
  // splitedEvents.forEach(({ properties }) => {
  //   csvSplitedEvents += `${properties.distinct_id},${properties.time},${properties.lead_id},${properties.pipeline},${properties.lead_status}\n`;
  // });
  // fs.writeFile(`./temp/dump/events_page-${databasePage}_${now}.csv`, csvSplitedEvents, (error) => {
  //   if (error) throw new Error(error);
  //   console.log('Success with Events writing.');
  // });
};

export default async () => {
  // Do it only once
  // mixpanelImporter.track('Vyroba', { lead_id: 0, pipeline: '', status: 0 });

  const statsWithLeads = await addLeadsStats(databasePage);
  if (statsWithLeads.length === 0) return;
  console.log('Stats With Leads: ', statsWithLeads.length, '\n');
  const statsWithCustomers = await addCustomersStats(statsWithLeads);
  console.log('Stats With Customers: ', statsWithCustomers.length, '\n');
  const statsWithEvents = await addEventsStats(statsWithCustomers);
  console.log('Stats With Events | length: ', statsWithEvents.length, '\n');
  const statsWithWorkDates = addWorkDatesStats(statsWithEvents);
  console.log('Stats With WorkDates: ', statsWithWorkDates.length, '\n');
  importUsers(statsWithWorkDates);
  importEvents(statsWithWorkDates);
};
