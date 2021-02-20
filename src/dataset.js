// Coolection of amoCRM system values

const firstDatabasePage = 5;
const initDate = '2020-05-05';
const startingTimecut = '13:30';
const stoppingTimecut = '12:30';
const timecutsGap = 300000; // 5 minutes

const workDays = ['Monday', 'Wednesday', 'Saturday'];

const hlavni = {
  id: 3335653,
  qlf: 33478963,
  prod: 33479020,
  hold: 33478966,
};

const demo = {
  id: 3332665,
  qlf: 33458329,
  prod: 33458332,
};

const zdrave = {
  id: 1425106,
  prod: 22328251,
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
  initDate,
  workDays,
  hlavni,
  demo,
  zdrave,
  contactsFieldsId,
  funnels,
  finished,
  firstDatabasePage,
  startingTimecut,
  stoppingTimecut,
  timecutsGap,
};
