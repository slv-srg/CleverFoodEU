import schedule from 'node-schedule';
import run from '../src/updater.js';

//  mon - wed - sat
schedule.scheduleJob('11 4 * * 2,4,7', run);
