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
 * Communicates with Firestore for a user's devices to control them or read
 * the current state.
 */

import * as admin from 'firebase-admin'
import { SmartHomeV1SyncDevices, SmartHomeV1ExecuteRequestExecution } from 'actions-on-google'
import { ApiClientObjectMap } from 'actions-on-google/dist/common'

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
})
const db = admin.firestore()
const settings = {timestampsInSnapshots: true}
db.settings(settings)

interface UpdatePayload {
  name?: string
  nicknames?: string[]
  states?: {[key: string]: any}
}

export async function updateDevice(userId: string, deviceId: string,
    name: string, nickname: string, states: ApiClientObjectMap<string | boolean | number>) {

  // Payload can contain any state data
  // tslint:disable-next-line
  const updatePayload: UpdatePayload = {}
  if (name) {
    updatePayload['name'] = name
  }
  if (nickname) {
    updatePayload['nicknames'] = [nickname]
  }
  if (states) {
    updatePayload['states'] = states
  }
  await db.collection('devices').doc(deviceId)
    .update(updatePayload)
}

export async function addDevice(data: ApiClientObjectMap<string | boolean | number>) {
  await db.collection('devices').doc(data.id as string).set(data)
}

export async function deleteDevice(deviceId: string) {
  await db.collection('devices').doc(deviceId).delete()
}

interface DatabaseDoc {
  room: string
}

export async function getDevices(): Promise<SmartHomeV1SyncDevices[]> {
  const devices: SmartHomeV1SyncDevices[] = []
  const querySnapshot = await db.collection('devices').get()

  querySnapshot.forEach(doc => {
    const data = doc.data() as DatabaseDoc
    const device: SmartHomeV1SyncDevices = {
      id: doc.id,
      type: 'action.devices.types.COMPUTER',
      traits: [
        'action.devices.traits.LockUnlock',
        'action.devices.traits.Modes',
        'action.devices.traits.TemperatureControl'
      ],
      name: {
        defaultNames: ['PC'],
        name: doc.id,
        nicknames: [doc.id],
      },
      roomHint: data.room,
      willReportState: true,
      attributes: {
        availableModes: [{
          name: 'mode',
          name_values: [{
            name_synonym: ['mode'],
            lang: 'en'
          }],
          settings: [{
            setting_name: 'Sleep',
            setting_values: [{
              setting_synonym: ['sleep', 'sleep mode'],
              lang: 'en'
            }]
          }, {
            setting_name: 'Normal',
            setting_values: [{
              setting_synonym: ['normal', 'normal mode'],
              lang: 'en'
            }]
          }]
        }],
        queryOnlyTemperatureControl: true,
        temperatureUnitForUX: 'C'
      },
    }
    devices.push(device)
  })

  return devices
}

export async function getState(deviceId: string):
    Promise<ApiClientObjectMap<string | boolean | number>> {

  const doc = await db.collection('devices').doc(deviceId).get()

  if (!doc.exists) {
    throw new Error('deviceNotFound')
  }

  return doc.data()!.states
}

// Payload can contain any state data
// tslint:disable-next-line
type StatesMap = ApiClientObjectMap<any>

export async function execute(deviceId: string,
    execution: SmartHomeV1ExecuteRequestExecution):
    Promise<StatesMap> {

  const doc = await db.collection('devices').doc(deviceId).get()

  if (!doc.exists) {
    throw new Error('deviceNotFound')
  }

  const states: StatesMap = {
    online: true,
  }
  const data = doc.data()
  if (!data!!.states.online) {
    throw new Error('deviceOffline')
  }
  switch (execution.command) {
    // action.devices.commands.LockUnlock
    case 'action.devices.commands.LockUnlock':
      if (!execution.params.lock) {
        throw new Error('notSupported') // Can't unlock PC
      }
      states['isLocked'] = execution.params.lock
      await db.collection('devices').doc(deviceId).update({ states })
      break

    // action.devices.traits.Modes
    case 'action.devices.commands.SetModes':
      const currentModeSettings: {
        [key: string]: string,
      } = data!.states.currentModeSettings
      for (const mode of Object.keys(execution.params.updateModeSettings)) {
        const setting = execution.params.updateModeSettings[mode]
        currentModeSettings[mode] = setting
      }
      states['currentModeSettings'] = currentModeSettings
      await db.collection('devices').doc(deviceId).update({ states })
      break

    // action.devices.traits.TemperatureControl
    case 'action.devices.commands.SetTemperature':
      states['temperatureSetpointCelsius'] = execution.params.temperature
      states['temperatureAmbientCelsius'] = execution.params.temperature
      await db.collection('devices').doc(deviceId).update({ states })
      break

    // action.devices.traits.Toggles
    case 'action.devices.commands.SetToggles':
      const currentToggleSettings: {
        [key: string]: boolean,
      } = data!.states.currentToggleSettings
      for (const toggle of Object.keys(execution.params.updateToggleSettings)) {
        const enable = execution.params.updateToggleSettings[toggle]
        currentToggleSettings[toggle] = enable
      }
      states['currentToggleSettings'] = currentToggleSettings
      await db.collection('devices').doc(deviceId).update({ states })
      break

    default:
      throw new Error('actionNotAvailable')
  }

  return states
}

export async function disconnect() {
//   await setHomegraphEnable(userId, false)
}