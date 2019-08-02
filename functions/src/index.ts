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

import * as util from 'util'
import * as Firestore from './firestore'

// Smart home imports
import {
  smarthome,
  SmartHomeV1ExecuteResponseCommands,
} from 'actions-on-google'

const app = smarthome({
  debug: true,
})
const functions = require('firebase-functions');

exports.fakeauth = functions.https.onRequest((req: any, res: any) => {
  const responseurl = util.format('%s?code=%s&state=%s',
    decodeURIComponent(req.query.redirect_uri), 'xxxxxx',
    req.query.state)
  console.log(responseurl)
  return res.redirect(responseurl)
})

exports.faketoken = functions.https.onRequest(async (req: any, res: any) => {
  const grantType = req.query.grant_type
    ? req.query.grant_type : req.body.grant_type
  const secondsInDay = 86400 // 60 * 60 * 24
  const HTTP_STATUS_OK = 200
  console.log(`Grant type ${grantType}`)

  let obj
  if (grantType === 'authorization_code') {
    obj = {
      token_type: 'bearer',
      access_token: '123access',
      refresh_token: '123refresh',
      expires_in: secondsInDay,
    }
  } else if (grantType === 'refresh_token') {
    obj = {
      token_type: 'bearer',
      access_token: '123access',
      expires_in: secondsInDay,
    }
  }
  res.status(HTTP_STATUS_OK).json(obj)
})

exports.smarthome = functions.https.onRequest(app)

app.onSync(async (body, headers) => {
  const devices = await Firestore.getDevices()
  return {
    requestId: body.requestId,
    payload: {
      agentUserId: 'userId',
      devices,
    },
  }
})

interface DeviceStatesMap {
  // tslint:disable-next-line
  [key: string]: any
}
app.onQuery(async (body, headers) => {
  const deviceStates: DeviceStatesMap = {}
  const {devices} = body.inputs[0].payload
  await Promise.all(devices.map(async (device) => {
    const states = await Firestore.getState(device.id)
    deviceStates[device.id] = states
  }))
  return {
    requestId: body.requestId,
    payload: {
      devices: deviceStates,
    },
  }
})

app.onExecute(async (body, headers) => {
  const commands: SmartHomeV1ExecuteResponseCommands[] = [{
    ids: [],
    status: 'SUCCESS',
    states: {},
  }]

  const {devices, execution} = body.inputs[0].payload.commands[0]
  await Promise.all(devices.map(async (device) => {
    try {
      const states = await Firestore.execute(device.id, execution[0])
      commands[0].ids.push(device.id)
      commands[0].states = states

      await app.reportState({
        agentUserId: 'userId',
        requestId: Math.random().toString(),
        payload: {
          devices: {
            states: {
              [device.id]: states,
            },
          },
        },
      })
    } catch (e) {
      commands.push({
        ids: [device.id],
        status: 'ERROR',
        errorCode: e.message,
      })
    }
  }))

  return {
    requestId: body.requestId,
    payload: {
      commands,
    },
  }
})

app.onDisconnect(async (body, headers) => {
  await Firestore.disconnect()
})
