# Smart PC
This is a sample project that you can run on your computer, allowing it to be
connected to the Google Assistant through the [smart home integration](http://developers.google.com/smarthome).

## Setup

### Prerequisites
1. Install dependencies by running `yarn`

### Firebase
1. Create a new [Firebase project](https://firebase.google.com) (or use an existing project)
1. Take note of the project id
1. Run `yarn init:firebase <project-id>`

### Google Cloud
1. Go to the [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
1. Generate a new private key and save the JSON as `service-account-key.json` in this directory.

### Smart Home integration
1. Open the [Actions Console](https://console.actions.google.com)
1. Create a new Actions project, then select your Firebase project.
1. On the onboarding page, select **Home Control** and then **Smart Home**
1. Run `yarn build && yarn deploy`. This will deploy a webhook to Cloud Functions for Firebase.
1. Follow the directions shown at the bottom of the output.
1. In the Actions Console, press **Test** to begin testing

### PC Profile
Create a profile for your PC (this only needs to be run once)

1. Run `yarn init:pc`
1. Answer questions about your device

A configuration file will be created. If this file is deleted, you will need to run this step again.

### Connect your PC to your Google Assistant
1. In the Google Home app, go to the **Home** tab and select **Add**
1. Select **Set up device**
1. Select **Have something already set up?**
1. Click on **[test] My test app**
1. Your account will be linked

## Run
Run `yarn start` to start the client script.
You will be able to control your PC through the Google Assistant

# LICENSE
See `LICENSE`.
