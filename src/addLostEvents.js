import Mixpanel from 'mixpanel';
// import moment from 'moment';
import pkg from './dataset.js';
import mpTokens from '../tokens/mixpanel-tokens.js';
import Dates from './Dates.js';

const {
  target,
} = pkg;

// const dateToTimestamp = (date) => moment(date).format('X');

const mixpanelToken = mpTokens[`${target}`].token;
const mixpanelSecret = mpTokens[`${target}`].secret;

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
      $insert_id: '28545259-2021-03-13',
      distinct_id: 45524645,
      time: Number(Dates.dateToTimestamp('2021-03-13 03:00')),
      lead_id: '28545259',
      pipeline: 'full',
    },
  },
];

mixpanelImporter.import_batch(lostEvent);
