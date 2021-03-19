import _ from 'lodash';
import moment from 'moment';

const now = moment().format('YYYY-MM-DD');
const todayEndingTimestamp = moment({ hour: 23, minute: 59, seconds: 59 }).format('X') * 1000;
const dateToString = (timestamp) => moment(timestamp).format('YYYY-MM-DD');
const dateToWeekday = (timestamp) => moment(timestamp).format('dddd');
const dateToTime = (timestamp) => moment(timestamp).format('HH:mm');
const datePlusOneDay = (timestamp) => moment(timestamp).add(1, 'day');
const dateToTimestamp = (date) => Number(moment(date).format('X'));
const dateToWeekNum = (date) => moment(date).format('GGGG-[W]WW');
const getFirstWeekNum = (date) => dateToWeekNum(_.head(date));
const getLastWeekNum = (date) => dateToWeekNum(_.last(date));

module.exports = {
  now,
  todayEndingTimestamp,
  dateToString,
  dateToWeekday,
  dateToTime,
  datePlusOneDay,
  dateToTimestamp,
  getFirstWeekNum,
  getLastWeekNum,
};
