import _ from 'lodash';
import moment from 'moment';

const now = moment().format('YYYY-MM-DD');

// Определяем константу на старте. А нам нужно значение того дня в который запускается обработка
const todayEndingTimestamp = moment({ hour: 23, minute: 59, seconds: 59 }).format('X') * 1000;

const dateToString = (timestamp) => moment(timestamp).format('YYYY-MM-DD');

const dateToWeekday = (timestamp) => moment(timestamp).format('dddd');

const dateToTime = (timestamp) => moment(timestamp).format('HH:mm');

const datePlusOneDay = (timestamp) => moment(timestamp).add(1, 'day');

const dateToTimestamp = (date) => Number(moment(date).format('X'));

const dateToWeekNum = (date) => moment(date).format('GGGG-[W]WW');

const getFirstWeekNum = (arrayOfDates) => dateToWeekNum(_.head(arrayOfDates));

const getLastWeekNum = (arrayOfDates) => dateToWeekNum(_.last(arrayOfDates));

const getIWeekNum = (cohort, counter) => moment(cohort).add(counter, 'week').format('GGGG-[W]WW');

const getWeekNumList = (arrayOfDates) => {
  const result = [];
  _.forEach(arrayOfDates, (item) => {
    const weekNumOfItem = dateToWeekNum(item);
    if (!_.includes(result, weekNumOfItem)) {
      result.push(weekNumOfItem);
    }
  });
  return result;
};

export default {
  now,
  todayEndingTimestamp,
  dateToString,
  dateToWeekday,
  dateToTime,
  datePlusOneDay,
  dateToTimestamp,
  getFirstWeekNum,
  getLastWeekNum,
  getIWeekNum,
  getWeekNumList,
};
