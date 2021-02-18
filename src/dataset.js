import moment from 'moment';

const firstDatabasePage = 1;
const initDate = '2020-05-05';
const timecut = [12, 0];
const todayDate = moment().format().slice(0, 10);

const workDays = ['Monday', 'Wednesday', 'Saturday'];

const workDates = () => {
  const result = [];

  const iter = (date) => {
    if (date > todayDate) return;
    const weekday = moment(date).format('dddd');
    if (workDays.includes(weekday)) {
      result.push(date);
    }
    const nextDate = moment(date)
      .add(1, 'days')
      .format()
      .slice(0, 10);
    iter(nextDate);
  };

  iter(initDate);
  return result;
};

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

const finished = 142;

export default {
  initDate,
  todayDate,
  workDays,
  hlavni,
  demo,
  zdrave,
  finished,
  firstDatabasePage,
  timecut,
  workDates,
};
