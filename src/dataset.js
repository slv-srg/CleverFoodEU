// Coolection of amoCRM business process values

const databasePage = 1;
const pageLimit = 250;
const timeout = pageLimit * 1000;
// const timeout = pageLimit * 1000;
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
  startingTimecut,
  stoppingTimecut,
  eventsTimeGap,
};
