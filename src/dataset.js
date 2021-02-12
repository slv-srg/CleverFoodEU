import moment from 'moment';

const initDate = '2020-05-05';
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

export default {
  initDate,
  todayDate,
  workDates,
};
