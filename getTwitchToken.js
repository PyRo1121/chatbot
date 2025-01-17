import fetch from 'node-fetch';
import 'dotenv/config';

async function getNewToken() {
    const clientId = process.env.TWITCH_BOT_CLIENT_ID;
    const clientSecret = process.env.TWITCH_BOT_CLIENT_SECRET;
    const refreshToken = process.env.TWITCH_BOT_REFRESH_TOKEN;

    try {
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        });

        const data = await response.json();
        
        if (data.access_token) {
            console.log('New OAuth token:', `oauth:${data.access_token}`);
            console.log('\nUpdate your .env file with this new token in the OAUTH_TOKEN field');
        } else {
            console.error('Failed to get token:', data);
        }
    } catch (error) {
        console.error('Error getting new token:', error);
    }
}

getNewToken();
