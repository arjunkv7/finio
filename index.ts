// Must be the very first import — polyfills crypto.getRandomValues for Hermes
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// HeadlessJS task: triggered by SmsReceiver (BroadcastReceiver) when a new SMS
// arrives — runs even if the app is fully closed.
AppRegistry.registerHeadlessTask(
  'SmsTransactionTask',
  () => require('./src/tasks/SmsTransactionTask').default
);
