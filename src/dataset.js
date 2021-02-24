import moment from 'moment-timezone';

moment.tz.setDefault('Europe/Prague');
const timestamp = (date) => moment(moment(date).format('X') * 1000).tz('Europe/Prague');

// Coolection of amoCRM business process values

const databasePage = 5;
const pageLimit = 250;
const timeout = pageLimit * 1000;
const initDate = '2020-05-05';
const startingTimecut = '13:30';
const stoppingTimecut = '12:30';
const eventsTimeGap = 300000; // 5 minutes

const workDays = ['Monday', 'Wednesday', 'Saturday'];

const hlavni = {
  id: 3335653,
  qlf: 33478963,
  prod: 33479020,
  hold: 33478966,
  finished: 142,
};

const demo = {
  id: 3332665,
  qlf: 33458329,
  prod: 33458332,
  finished: 142,
};

const zdrave = {
  id: 1425106,
  prod: 22328251,
  finished: 142,
};

const contactsFieldsId = {
  email: 265795,
  phone: 265793,
  address: 470187,
};

const funnels = {
  hlavni,
  demo,
  zdrave,
};

const finished = 142;

const cornerCases = {
  27314549: [
    timestamp('2020-08-30 16:46'),
    timestamp('2020-09-01 09:26'),
    timestamp('2020-09-04 11:48'),
    timestamp('2020-09-08 14:15'),
    timestamp('2020-09-10 08:00'),
    timestamp('2020-09-11 19:13'),
    timestamp('2020-09-27 11:43'),
    timestamp('2020-10-04 07:00'),
  ],
  27707771: [
    timestamp('2020-10-19 20:56'),
    timestamp('2020-10-25 15:39'),
  ],
  27492557: [
    timestamp('2020-09-29 12:15'),
    timestamp('2020-10-25 15:42'),
  ],
  27656565: [
    timestamp('2020-10-17 21:57'),
    timestamp('2020-10-23 16:23'),
    timestamp('2020-10-30 16:00'),
    timestamp('2020-11-15 13:52'),
  ],
  28153975: [
    timestamp('2021-01-28 13:28'),
    timestamp('2021-02-02 15:10'),
  ],
  28173241: [
    timestamp('2021-01-10 12:00'),
    timestamp('2021-01-14 14:00'),
    timestamp('2021-01-17 12:00'),
    timestamp('2021-01-21 14:00'),
    timestamp('2021-01-24 12:00'),
    timestamp('2021-01-28 14:00'),
    timestamp('2021-01-31 12:00'),
    timestamp('2021-02-04 14:00'),
    timestamp('2021-02-07 12:00'),
    timestamp('2021-02-11 14:00'),
    timestamp('2021-02-14 12:00'),
    timestamp('2021-02-18 14:00'),
    timestamp('2021-02-21 12:00'),
    timestamp('2021-02-25 14:00'),
  ],
};

export default {
  databasePage,
  pageLimit,
  timeout,
  initDate,
  workDays,
  hlavni,
  demo,
  zdrave,
  contactsFieldsId,
  funnels,
  finished,
  cornerCases,
  startingTimecut,
  stoppingTimecut,
  eventsTimeGap,
};
