module.exports = {
	twitch: {
		username: 'USERNAME_GOES_HERE',
		oauth:    'KEY_GOES_HERE',
		channels: ['CHANNEL_GOES_HERE']
	},
	default_player: 'PLAYER_NAME_GOES_HERE',
	chat_voice: {
		enabled: true,
		provider: 'google',
		credentials: './GCP_TwitchChatVoiceOver.json',
		twitch_mappings: {
			osx: {
				puffy2303: 'Karen',
				yobi9:     'Daniel'
			},
			google: {
				puffy2303: 'en-AU-Wavenet-A',
				yobi9:     'en-GB-Wavenet-B'
			}
		}
	}
};
