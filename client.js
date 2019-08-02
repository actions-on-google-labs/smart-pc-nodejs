/* Copyright 2019, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const admin = require('firebase-admin');
const lockSystem = require('lock-system');
const sleepMode = require('sleep-mode');
const si = require('systeminformation');
const serviceAccount = require('./service-account-key.json');

const PC_CONFIG = require('./pc.config.json');
const PERIOD_REPORT_CPU_TEMPERATURE_MS = 1000 * 60 * 5; // Every 5 minutes

let systemLocked = false;
let systemAsleep = false;

console.log('Initializing...');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const pcRef = db.collection('devices').doc(PC_CONFIG.nickname);

const stateListener = pcRef.onSnapshot(async (docSnapshot) => {
  const {states} = docSnapshot.data()

  // Check if the state is set to sleep
  if (states.currentModeSettings && states.currentModeSettings.mode === 'Sleep' &&
      states.online && !systemAsleep) {
    console.log('Nighty night!');
    systemAsleep = true
    await pcRef.update({
      'states.online': false,
    });
    sleepMode(async (err, stderr, stdout) => {
      await pcRef.update({
        'states.online': true,
        'states.currentModeSettings.mode': 'Normal'
      });
      systemAsleep = false
    });
    return;
  }

  // Check if the state is set to lock
  if (states.isLocked === true && states.online && !systemLocked) {
    console.log('Securing computer at', new Date().toString());
    systemLocked = true
    lockSystem(); // Synchronous. Function ends when PC is being unlocked.
    await pcRef.update({
      'states.isLocked': false,
    });
    systemLocked = false
    console.log('Unlocked computer at', new Date().toString())
    return;
  }
});

let cacheCpuTemperature;
const cpuTemperatureLoop = setInterval(async () => {
  const {main} = await si.cpuTemperature();
  if (cacheCpuTemperature === main) {
    // Don't send CPU temperature if it has not changed.
    return;
  }
  cacheCpuTemperature = main;
  try {
    await pcRef.update({
      'states.temperatureAmbientCelsius': main,
      'states.temperatureSetpointCelsius': main
    });
  } catch (e) {
    console.warn('Unable to report CPU temperature', e);
  }
}, PERIOD_REPORT_CPU_TEMPERATURE_MS);

const setup = async () => {
  await pcRef.update({
    'states.online': true,
    'states.isLocked': false,
    'states.currentModeSettings.mode': 'Normal',
  });
  console.log('Connected!');
}

const exit = async () => {
  // Exiting script
  console.log('Disconnecting...');
  stateListener(); // Close Firestore listener
  clearInterval(cpuTemperatureLoop); // Clear loop
  await pcRef.update({
    'states.online': false
  });
}

setup()

process.on('SIGINT', exit);

process.on('SIGABRT', exit);
