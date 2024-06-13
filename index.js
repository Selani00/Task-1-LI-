const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {SpacesServiceClient} = require('@google-apps/meet').v2;
const { auth } = require('google-auth-library');

const SCOPES = ['https://www.googleapis.com/auth/meetings.space.created'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');


const app = express();

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */

async function loadSavedCredentialsIfExist() {
    try {
      const content = await fs.readFile(TOKEN_PATH);
      const credentials = JSON.parse(content);
      return auth.fromJSON(credentials);
    } catch (err) {
      console.log(err);
      return null;
    }
  }

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */

async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
  }

  /**
 * Load or request or authorization to call APIs.
 *
 */

  async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(client);
    }
    return client;
  }
  /**
 * Creates a new meeting space.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 * @return {Promise<string>} The URL of the created Google Meet.
 */
async function createSpace(authClient) {
    const meetClient = new SpacesServiceClient({
      authClient: authClient
    });
    const request = {};
    const response = await meetClient.createSpace(request);
    return response[0].meetingUri;
  }


  // Define a POST route to create a new Google Meet link
app.post('/create-meet', async (req, res) => {
    try {
      const authClient = await authorize();
      const meetLink = await createSpace(authClient);
      res.status(200).json({ meetLink: meetLink });
    } catch (error) {
      console.error('Error creating Meet link:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  


app.listen(5000, ()=>{
    console.log("Server is running on port 5000");
})