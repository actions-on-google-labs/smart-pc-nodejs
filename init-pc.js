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

/**
 * Setup the PC SYNC response.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const readline = require('readline-promise').default;
const serviceAccount = require('./service-account-key.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const PC_CONFIG_FILE = 'pc.config.json';

// Answer some questions about the PC to personalize the SYNC response
(async function() {
  const nickname = await rl.questionAsync('What is the name of your PC? ');
  const room = await rl.questionAsync('What room is your PC in? ');
  console.log(`Saving ${nickname} configuration...`)

  // Save data
  await db.collection('devices').doc(nickname).set({
    room,
  })

  // Save device configuration
  fs.writeFileSync(PC_CONFIG_FILE, JSON.stringify({
    nickname,
    room,
  }))

  process.exit(0)
})();