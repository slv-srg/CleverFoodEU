import Mixpanel from 'mixpanel';
import moment from 'moment';

const dateToTimestamp = (date) => moment(date).format('X');

// const mixpanelToken = '9fa6f844998be478fe9aec46c90fbe1b'; // test
// const mixpanelSecret = '78ca2eadb48d7286feb8f2ad77baecbb'; // test

const mixpanelToken = '092a4db9c3585561a9e36deafa48ba75'; // v. 6.02
const mixpanelSecret = 'a084920fb0d01f50dbc9b6ef76dd44b8'; // v. 6.02
const mixpanelImporter = Mixpanel.init(
  mixpanelToken,
  {
    secret: mixpanelSecret,
    debug: true,
    verbose: true,
  },
);

const lostEvent = [
  {
    event: 'Vyroba',
    properties: {
      $insert_id: '28553181-2021-03-10',
      distinct_id: 33656847,
      time: Number(dateToTimestamp('2021-03-10 03:00')),
      // time: 1615330860,
      lead_id: '28553181',
      pipeline: 'hlavni',
    },
  },
];

mixpanelImporter.import_batch(lostEvent);
