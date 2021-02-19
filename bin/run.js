import schedule from 'node-schedule';
import run from '../src/main.js';

const rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [new schedule.Range(0, 5)]; // every Sunday - Friday, 10pm
rule.hour = 21;
rule.minute = 41;
rule.tz = 'Europe/Prague';

schedule.scheduleJob(rule, run);
