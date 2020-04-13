NesTrisStatsUI is a project to re-render NES Tetris and computate game play stats.

It consists or a nodejs server app and a HTML+JS+Canvas Frontend UI which can be run in a browser widget in OBS.


## Features

* Historical game score tracking in local sqlite3 DB
* Connection to twitch channel to extract chat in real time, (optionally with voice)
* Connection to google voice or OSX `say` to speak chat entries 
    * Voices are assigned randomly to a chat user and reused for that user for consistent conversation
* Lots of stats for the ongoing game:
	* Lines/Scores
	* Transition Score (first level change)
    * Tetris Rate / Burn counter
    * Running Tetris rate which indicate the singles/doubles/triples/tetris taken
    * Drought counter
    * Piece distribution with drought representation for all pieces
    * Occurence rates for Singles/Doubles/Tripes/Tetris (Last one being Tetris Rate)
    * Point tracking per SoftDrop/Single/Doubles/Triples/tetris with their percentage contribution to the total score


## Setup

### Dependencies

* git clone project
* `npm install`
* copy `config.example.js` to `config.js` and edit the values according to what you need


### DB

* install sqlite3 for your system
* copy the content of the file `setup.sql`
* run `sqlite3 tetris.db`
* paste sql statement


### Twitch

You need a twitch oauth token to be able to connect to chat. Get started [here](https://dev.twitch.tv/docs/irc)

### Google voice

To use Google Voice, you need a Google account and you need to export your google credentials as an environment variable before runnng the server.

### OCR

Install and configure [NESTrisOCR](https://github.com/alex-ong/NESTrisOCR) to capture your local Tetris gameplay (window for emulators, openCV preferably for NES video capture)

Notes:
* The current `NEStrisStatsUI` works with a custom fork of `NESTrisOCR` to support Das Trainer. That version is no yet public
* A version of `NEStrisStatsUI` to work with Vanilla `NESTrisOCR` is in the works

Make sure you configure NEsTrisOCR to send th 

## Running

1. Run NESTrisStatsUI: `npm run start`
2. Run NesTrisOCR: `python3 main.py`
3. Open in Browser `http://localhost:3000/skin_das_trainer.html`

You should be able to verify see the tetris gaeplay being re-rendered


### OBS

The 2 layouts `skin_das_trainer.html` and `competition_layout1.html` are designed to be displayed at exacly `1280x720` (i.e. 720p). 

In OBS:

1. set the canva size fo 1280x720
2. Add a browser component, at exactly 1280x720, make it load the resource `http://localhost:3000/skin_das_trainer.html`

If you have a webcam, set a video overlay to match the layout slot.

To run and stream, repeat the steps 1, and 2 above, but replace step 3 by 

3. Run OBS


## Contribute

TODO


## Bonus: Competition Layout

The project contains a competition layout where 2 OCR streams can be sent to individual ports and rerendered. 

So far only the score differential, tetris rate and running tetris rate are supported for both players


## References

* Capture device: [EasierCap](https://www.amazon.com/Capture-Grabber-Recorder-Adapter-Converter/dp/B00STDO9PM)