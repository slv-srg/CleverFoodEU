/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-named-as-default */
/* eslint-disable import/no-named-as-default-member */

import _ from 'lodash';
import fs from 'fs';
import moment from 'moment-timezone';
import connect from '../src/connect.js';
// import Mixpanel from 'mixpanel';
// import mpTokens from '../tokens/mixpanel-tokens.js';
import pkg from '../src/dataset.js';

moment.tz.setDefault('Europe/Prague');

const {
  // target,
  databasePage,
  pageLimit,
  timeout,
  workDays,
  hlavni,
  demo,
  // zdrave,
  contactsFieldsId,
  leadsFieldsId,
  // funnels,
  finished,
  cornerCases,
  startingTimecut,
  stoppingTimecut,
  eventsTimeGap,
  daysToLossQty,
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
const now = moment().format('YYYY-MM-DD');
const dateToString = (timestamp) => moment(timestamp).format('YYYY-MM-DD');
const dateToWeekday = (timestamp) => moment(timestamp).format('dddd');
const dateToTime = (timestamp) => moment(timestamp).format('HH:mm');
const datePlusOneDay = (timestamp) => moment(timestamp).add(1, 'day');
const dateToWeekNum = (date) => moment(date).format('GGGG-[W]WW');
const buildFirstWeekNum = (date) => dateToWeekNum(_.head(date));
const buildLastWeekNum = (date) => dateToWeekNum(_.last(date));
const dateToTimestamp = (date) => Number(moment(date).format('X'));
const cohortToNumeric = (string) => string.split('-W').join('');

// const mixpanelToken = mpTokens[`${target}`].token; // test
// const mixpanelSecret = mpTokens[`${target}`].secret; // test

// const mixpanelImporter = Mixpanel.init(
//   mixpanelToken,
//   {
//     secret: mixpanelSecret,
//     debug: true,
//     verbose: true,
//   },
// );

const crm = connect();

const addCustomersStats = async (pageNum) => {
  console.log(`addCustomersStats FUNCTION for page #${pageNum} is run \n`);
  const statsWithCustomers = [];

  await crm.request
    .get('/api/v4/contacts', {
      page: pageNum,
      limit: pageLimit,
      with: ['leads', 'contacts'],
      filter: {
      },
    })
    .then(({ data }) => {
      if (!data) return;
      if (data.status === 401) {
        console.log(`${data.title}: ${data.detail}`);
        process.exit(0);
      }
      const { _embedded } = data;
      const { contacts } = _embedded;
      contacts.forEach((contact) => {
        const { custom_fields_values: fields } = contact;
        if (!fields) return;

        const { _embedded: $embedded } = contact;
        const { leads } = $embedded;
        if (!leads.length) return;

        const contactDetails = {};
        fields.forEach((field) => {
          const { field_id: fieldId } = field;
          const [value] = field.values;
          switch (fieldId) {
            case contactsFieldsId.email:
              contactDetails.email = value.value;
              break;
            case contactsFieldsId.phone:
              contactDetails.phone = value.value;
              break;
            case contactsFieldsId.address:
              contactDetails.address = value.value;
              break;
            default:
              break;
          }
        });

        const leadsDetails = [];
        leads.forEach(({ id }) => leadsDetails.push(id));

        statsWithCustomers.push({
          customer: {
            customer_id: contact.id,
            name: contact.name,
            created_at: contact.created_at,
            email: contactDetails.email,
            phone: contactDetails.phone,
            address: contactDetails.address,
            leads_id: leadsDetails,
          },
        });
      });
    })
    .catch((error) => console.log('The Error is occured: ', error));
  // return statsWithCustomers; // short test stop

  return statsWithCustomers.length
    ? [...statsWithCustomers, ...(await addCustomersStats(pageNum + 1))]
    : [];
};

const addLeadsStats = async (statsWithCustomers) => {
  console.log('addLeadsStats FUNCTION is run \n');
  const statsWithLeads = [...statsWithCustomers];

  const returnResultAfterPause = (response) => new Promise((resolve) => {
    setTimeout(() => {
      resolve(_.filter(response, 'leads[0]'));
    }, timeout);
  });

  // const testChunk = statsWithLeads.slice(-100); // TEST DIRECTIVE
  statsWithLeads.forEach((item) => {
    item.leads = [];
    const { customer } = item;
    const { leads_id: leadsId } = customer;
    leadsId.forEach((id) => {
      crm.request
        .get(`/api/v4/leads/${id}`, {
          filter: {
            statuses,
          },
        })
        .then(({ data }) => {
          if (!data) return;
          const { custom_fields_values: fields } = data;
          if (!fields) return;

          let firstDeliveryDate = '';
          let lastDeliveryDate = '';
          fields.forEach((field) => {
            const { field_id: fieldId } = field;
            const [value] = field.values;
            switch (fieldId) {
              case leadsFieldsId.firstDeliveryDate:
                firstDeliveryDate = value.value;
                break;
              case leadsFieldsId.lastDeliveryDate:
                lastDeliveryDate = value.value;
                break;
              default:
                break;
            }
          });
          const leadDetails = {
            lead_id: id,
            price: data.price,
            pipeline_id: data.pipeline_id,
            status_id: data.status_id,
            created_at: data.created_at,
            first_delivery_date: firstDeliveryDate,
            last_delivery_date: lastDeliveryDate,
          };
          item.leads.push(leadDetails);
        })
        .catch((error) => console.log('The Error is occured: ', error));
    });
  });
  return returnResultAfterPause(statsWithLeads);
};

const addEventsStats = async (statsWithLeads) => {
  console.log('addEventsStats FUNCTION is run \n');
  const statsWithEvents = [...statsWithLeads];

  const returnResultAfterPause = (response) => new Promise((resolve) => {
    setTimeout(() => {
      resolve(response);
    }, timeout);
  });

  statsWithEvents.forEach(({ leads }) => {
    leads.forEach((lead) => {
      const { lead_id: id } = lead;
      const eventsDates = [];

      crm.request
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
          const { _embedded } = data;
          const { events } = _embedded;
          events.forEach((event) => eventsDates.push(moment(event.created_at * 1000).tz('Europe/Prague')));

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
                $events.forEach((event) => eventsDates.push(moment(event.created_at * 1000).tz('Europe/Prague')));
              }
              lead.events_dates = eventsDates;
            })
            .catch((error) => console.log('The Error is occured: ', error));
        })
        .catch((error) => console.log('The Error is occured: ', error));
    });
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
        // next directive with 'eventsTimeGap' does exclude
        // the pair of the two nearest events if
        // there is less then 5 minutes gap between them (no fake events)
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

  statsWithWorkDates.forEach(({ leads }) => {
    leads.forEach((lead) => {
      const { lead_id: id, events_dates: events } = lead;
      if (!events) return;
      const workDates = [];
      const chunkedDates = [];

      if (_.has(cornerCases, id)) {
        chunkedDates.push(..._.chunk(cornerCases[id], 2));
      } else {
        events.sort((a, b) => a - b);
        chunkedDates.push(..._.chunk(events, 2));
      }

      chunkedDates.forEach((chunked) => {
        const result = buildWorkDates(chunked);
        workDates.push(...result);
      });

      lead.work_dates = workDates;
    });
  });
  return statsWithWorkDates;
};

const addCohortsStats = (statsWithWorkDates) => {
  fs.writeFile(`./temp/dump/statsWithWorkDates_${now}.json`, JSON.stringify(statsWithWorkDates), (error) => {
    if (error) throw new Error(error);
    console.log('statsWithWorkDates is successfully writing.');
  });

  console.log('addCohortsStats FUNCTION is run \n');
  const statsWithCohorts = [...statsWithWorkDates];
  statsWithCohorts.forEach((item) => {
    const { leads } = item;
    item.cohorts = [];
    const { cohorts } = item;
    // does this filter work properly?
    const filteredLeads = _.filter(leads, (lead) => !_.isEmpty(lead.work_dates));

    if (_.isEmpty(filteredLeads)) return;
    const workDatesColl = filteredLeads.map(({ work_dates: workDates }) => workDates);

    const sortedWorkDatesColl = workDatesColl.length > 1
      ? _.sortBy(workDatesColl, (elem) => elem[0])
      : workDatesColl;

    const workDatesSplited = [];
    if (sortedWorkDatesColl.length === 1) workDatesSplited.push(...sortedWorkDatesColl);
    else {
      workDatesSplited.push(sortedWorkDatesColl[0]);
      const { length } = sortedWorkDatesColl;

      for (let i = 1; i < length; i += 1) {
        const tail = _.last(_.last(workDatesSplited));
        const head = _.head(sortedWorkDatesColl[i]);
        if (moment(head).diff(moment(tail), 'days') >= daysToLossQty) {
          workDatesSplited.push(sortedWorkDatesColl[i]);
        } else {
          const { length: $length } = workDatesSplited;
          workDatesSplited[$length - 1] = _.concat(
            _.last(workDatesSplited),
            sortedWorkDatesColl[i],
          );
        }
      }
    }
    workDatesSplited.forEach((cohortDates) => {
      cohorts.push({
        // The problem is here
        cohort_start: buildFirstWeekNum(cohortDates),
        cohort_finish: buildLastWeekNum(cohortDates),
        cohort_dates: cohortDates,
      });
    });
  });
  // console.log('__statsWithCohorts__', statsWithCohorts);
  // statsWithCohorts.forEach((item) => {
  //   console.log('customer.leads_id', item.customer.leads_id);
  //   console.log('leads', item.leads);
  //   console.log('cohorts', item.cohorts);
  // });

  fs.writeFile(`./temp/dump/statsWithCohorts_${now}.json`, JSON.stringify(statsWithCohorts), (error) => {
    if (error) throw new Error(error);
    console.log('statsWithCohorts is successfully writing.');
  });

  return statsWithCohorts;
};

const getMaxDuration = (coll) => {
  let counter = 1;

  if (_.isPlainObject(coll[0])) {
    coll.forEach((item) => {
      if (item.duration > counter) {
        counter = item.duration;
      }
    });
  }
  return counter;
};

const buildCsv = (statsWithCohorts) => {
  const modifiedStats = [];
  statsWithCohorts.forEach((customerStat) => {
    const { customer, cohorts } = customerStat;
    cohorts.forEach((cohort) => {
      const { cohort_start: start, cohort_finish: finish } = cohort;
      // magic number '1': that's becauce subtract between 2nd and 1st weeks
      // means 2 weeks of vyroba in reality, not 1
      // magic number '47': it's a difference between value of 100 and 53 weeks
      // it's actual for finish in the next year than start
      const duration = start.slice(0, 4) === finish.slice(0, 4)
        ? cohortToNumeric(finish) - cohortToNumeric(start) + 1
        : cohortToNumeric(finish) - cohortToNumeric(start) + 1 - 47;
      modifiedStats.push({
        customerId: customer.customer_id,
        cohortStart: start,
        cohortFinish: finish,
        duration,
      });
    });
  });

  const sortedStats = _.reverse(_.sortBy(modifiedStats, ['cohortStart', 'duration']));

  console.log('__sortedStats__', sortedStats);

  const totalMaxDuration = getMaxDuration(sortedStats);
  let csvString = 'Week,Customers_QTY,Customers QTY reached 4th Week';

  for (let i = 1; i <= totalMaxDuration; i += 1) {
    csvString += `,Week ${i}`;
  }
  csvString += '\n';

  const allCohortsList = [];
  sortedStats.forEach((item) => {
    const { cohortStart } = item;
    if (!_.includes(allCohortsList, cohortStart)) {
      allCohortsList.push(cohortStart);
    }
  });

  allCohortsList.forEach((cohort) => {
    const cohortRelativeCustomers = _.filter(sortedStats, (elem) => elem.cohortStart === cohort);
    // console.log('__cohortRelativeCustomers__', cohortRelativeCustomers);
    csvString += `${cohort},${cohortRelativeCustomers.length}`;
    // console.log('__csv 1__', csvString);
    const reachedTargetWeek = _.filter(cohortRelativeCustomers, (elem) => elem.duration >= 4);
    csvString += `,${reachedTargetWeek.length}`;
    // console.log('__csv 2__', csvString);

    const cohortMaxDuration = getMaxDuration(cohortRelativeCustomers);
    // console.log('__cohortMaxDuration__', cohortMaxDuration);
    for (let i = 1; i <= cohortMaxDuration; i += 1) {
      const customerQtyForParticularWeek = _.filter(
        cohortRelativeCustomers, (elem) => elem.duration >= i,
      );
      csvString += `,${customerQtyForParticularWeek.length}`;
      // console.log('__csv 3__', csvString);
    }
    csvString += '\n';
  });

  // console.log('__cohorts__', csvString);
  fs.writeFile(`./temp/dump/cohorts_${now}.csv`, csvString, (error) => {
    if (error) throw new Error(error);
    console.log('Cohorts\' table is successfully writing.');
  });

  let csvForCheck = 'Week,Customers IDs\n';
  allCohortsList.forEach((cohort) => {
    const cohortRelativeCustomers = _.filter(sortedStats, (elem) => elem.cohortStart === cohort);
    csvForCheck += `${cohort}`;
    cohortRelativeCustomers.forEach((item) => {
      csvForCheck += `,${item.customerId}`;
    });
    csvForCheck += '\n';
  });

  // console.log('__customerForCheck__', csvForCheck);
  fs.writeFile(`./temp/dump/customers_${now}.csv`, csvForCheck, (error) => {
    if (error) throw new Error(error);
    console.log('Cohort Customer For Check table is successfully writing.');
  });
};

// ------ RUN ------

const run = async () => {
  const statsWithCustomers = await addCustomersStats(databasePage);
  console.log('Stats With Customers | length: ', statsWithCustomers.length, '\n');

  const statsWithLeads = await addLeadsStats(statsWithCustomers);
  console.log('Stats With Leads | length: ', statsWithLeads.length, '\n');

  const statsWithEvents = await addEventsStats(statsWithLeads);
  console.log('Stats With Events | length: ', statsWithEvents.length, '\n');

  const statsWithWorkDates = addWorkDatesStats(statsWithEvents);
  console.log('Stats With Work Dates | length: ', statsWithWorkDates.length, '\n');

  const statsWithCohorts = addCohortsStats(statsWithWorkDates);
  console.log('Stats With Cohorts | length: ', statsWithCohorts.length, '\n');

  buildCsv(statsWithCohorts);
};

run();
