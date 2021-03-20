import Mixpanel from 'mixpanel';
import pkg from './dataset.js';
import mpTokens from '../tokens/mixpanel-tokens.js';
import Dates from './Dates.js';

const {
  target,
} = pkg;

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
      $insert_id: '28539205-2021-03-15',
      distinct_id: 45520181,
      time: Number(Dates.dateToTimestamp('2021-03-15 03:00')),
      lead_id: '28539205',
      pipeline: 'hlavni',
    },
  },
];

mixpanelImporter.import_batch(lostEvent);
