As of 2020-07-13, this is the view of the Stats UI

![Full UI](./stats/full_ui.png)

Many stats are self-explanatory, but nevertheless, this document will go over each.

## Background Info

The Stats UI runs for a given player (defaults to "TIM"). Each completed game is recorded in a local sqlite3 database for that user.

Any piece in Tetris can have a drought (a sequence of pieces where a given piece doesn't come out). In modern Tetrises with bags, the maximum sequence length for a which doesn't come is 13 (2 consecutive bags of 7 pieces, where a piece type is the first of the first bag and the last of the second bag).


### Color-coding

Various components of the statsUI show stats driven by line clear events, or include inormation about line clear events. These will be color coded as followed:

* ![#1678FF](https://via.placeholder.com/15/1678FF/000000?text=+) `#1678FF`  for Singles
* ![#FF9F00](https://via.placeholder.com/15/FF9F00/000000?text=+) `#FF9F00`  for Doubles
* ![#FF00B9](https://via.placeholder.com/15/FF00B9/000000?text=+) `#FF00B9` for Triples
* ![#FFFFFF](https://via.placeholder.com/15/FFFFFF/000000?text=+) `#FFFFFF` for Tetrises (i.e. White!)


## PBs

![PBs](./stats/pbs.png)

Level 18 and 19 start PBs for the current player (retrieved from DB).

PBs are reported on score alone, not on number of lines


## High Scores

![High Scores](./stats/high_scores.png)

Reports the top 5 high scores for the current player in 2 sections:
* For the day
* Overall


## Lines

![Lines](./stats/lines.png)

Shows stats about lines cleared, by type of line clears. Contains 4 type of information:

* total number of lines clear (as read from the game UI)
* for each type of line clear, shows:
    * number of line clear events for that type
    * number of lines cleared  for that type
    * percentage of lines cleared for that type overall (Note: The percentage for tetrises is the "famous" tetris rate)


## Points

![Points](./stats/points.png)

Shows point stats for the game in 3 types of information:

* current score for the whole game (as read from the game UI)
* For each point line clear type, shows the points generated and the percentage contribution of that type of line clear to the overall score
* Also shows points accumulated from soft drops (labelled "Drops")


## Pieces

![Pieces](./stats/pieces.png)

This section is a little crowded with information

### Header

Shows:
* Number of pieces played in the game ![Piece count](./stats/pieces_count.png)
* "Eveneness" measurement for 3 game periods
    * Last 28 pieces (4 bags) ![Dev 28](./stats/pieces_dev28.png)
    * Last 56 pieces (8 bags) ![Dev 56](./stats/pieces_dev56.png)
    * All game pieces ![Dev All](./stats/pieces_devall.png)

The "evenness" metrics are calulated as follows:

![Evenness formula](./stats/evenness.png)

Notes on evenness:
* The formula is almost identical to the [Standard Deviation](https://en.wikipedia.org/wiki/Standard_deviation), but uses ratio rather than piece counts
* In modern tetrises, evenness for the *last 4 bags* and *last 8 bags* would be 0, since all pieces would have exactly a ratio of 1/7
* On a sufficiently long game, the number of *all game pieces* should also tend to zero, as the distribution for all pieces evens out
* The 3 metric can each take value within the range 0 (all pieces came out with the same number) to 35 (only one piece came out from a given sequence)


#### Reference for the formula:

Latex fomula below. Visit [http://atomurl.net/math/](http://atomurl.net/math/) to render it:
```
100 * \sqrt{(\sum_{piece type} (\frac{count_{piece type}}{count_{allpieces}} - \frac{1}{7} )^2) / 7}
```

Javascript function to compute it:
```javascript
function evenness(piece_counts) {
	const total_pieces = piece_counts.reduce((sum, num) => sum + num, 0);
	const deviation_sum = piece_counts.reduce((sum, num) => sum + Math.pow(num/total_pieces - 1/7, 2), 0);

	return 100 * Math.sqrt( deviation_sum / 7);
}

````

Sample values:
```javascript
// 28 piece bag, perfect evenness
evenness([4, 4, 4, 4, 4, 4, 4]); // 0

// 28 piece bag, okay-ish distribution
evenness([4, 6, 2, 1, 7, 5, 3]); // ~7.1

// 28 piece bag, worst possible distribution (only single piece released)
evenness([28, 0, 0, 0, 0, 0, 0]); // ~35.0

// 28 piece bag, very even ... except for a drought
evenness([0, 4, 5, 5, 4, 5, 5]); // ~6.0

```

### Disclaimer

I don't know if the evenness distribution makes much sense at all. I was looking for a single number that would represent whether the game, or a section thereof was "easy" or "hard". Especialy useful to look at right when I die.

Basically there are 2 kinds of metrics and stats:
* stats about the game itself, over which the player has no control piece distribution being the main one
* stats about skills (control of DAS, stacking, spin, tucks, etc.)

While I can show the piece distribution over an extended block of time, I was looking for a single number, sor of like the [unix load average](http://www.brendangregg.com/blog/2017-08-08/linux-load-averages.html), which also shows independent time frames (last 1min, 5mins, 15mins) to get a sense of how a server is doing.



### Distribution matrix

The second thing the piece section is the distribution matrix, which is crammed with information. There are 7 rows, one for each piece types, with the following information:

* Piece type label (colored based on the level)
* Number of piece released for that type
* Overall distribution of that piece in the game
* Visual representation for the piece distribution within a timeline of the last 120 pieces
    * Each dot represent a time when the piece was released
    * Dots are color coded based on the das value the piece had when it spawned (see section on das below)
    * If the piece experiences a drought, a continuous bar will be displayed (in grey for all piece types, but in orange for the I piece, because it is the most important drought type)
* Current drought counter for the piece

## DAS Section

![DAS](./stats/das.png)

### Header

The following informations are presented:
* Instant Das value with gauge ![DAS gauge](./stats/das_instant_das.png)
* Average Das value from when pieces spawned (newbie, will get a number below 10, average player 10-12, experts above 14) ![DAS average](./stats/das_average_das.png)
* 3 counters ![DAS groups](./stats/das_groups.png)
    * Number of pieces where spawn DAS was below 10 and below (red heart)
    * Number of pieces where spawn DAS was between 10 and 14 (both inclusive) (orange heart)
    * Number of pieces where spawn DAS was 15 or 16

### Matrix

The second section represents a timeline of piece spawning (just like the matrix in the Piece section above). Each column represent one piece spanwing. Approximately the last 150 pieces are presented.

The matrix position color code the dots based on the das values see section Header above), and position the dots based on the value too (full das on top, empty das below). The result represents a "signature" of the player skills at controlling DAS.

Additionally, each time DAS is lost (falls to 0 when moving pieces, a dim red vertical bar is displayed).

#### Sample DAS signatures:

* Average DAS player (myself - losing was a lot)

![DAS](./stats/das.png)

* Expert Das player (my son Tristan - almost never losing das)

![DAS Expert](./stats/das_expert.png)


## Height and State

![Height n State](./stats/height_n_state.png)

This section is yet another timeline. It is perfectly aligned with the DAS timeline above.

### header

The header conly contains the color-coded legend of the information provided. 4 states are being tracked:
* Is board Tetris-ready
* Is board in a perfect slope (decreasing or equal height from left to right)
* Is there a double Well
* Is player in a I-piece drought

### Matrix

The timeline represents the height of the board at a specific point in time.

The State of the board is represented as 3 lines below

Each line clear event is represented as a vertical line of the color code for line that line-clear type.

Example with all 3 types of markers:



## Score

![Score](./stats/score_no_transition.png)

2 information as presented:
* Current score (as read from game itself)
* Score at transition

Note: Transition is the first level change, Below is an example of the score box when transition has been reached and passed:

![Score with Transition](./stats/score_with_transition.png)


### Next

![Next](./stats/next.png)

Next piece box, just like in the game

### Board

![Board](./stats/board.png)

The board as read from the game itself

## I-Drought

![I Drought](./stats/i-drought.png)

This show information about I-piece droughts:

### Header

Show number of droughts there had been in the game so far.

### Panel

Shows the following information
* Current I-drought count (may be below 13, meaning not yet a drought)
* Shows the size of the last drought (number you want to look at right after you survive a long drought)
* Shows the longest drought that was experienced in the game

When the current drought is above 13, the number blinks in red.

### Standard Metrics

![Standard Stats](./stats/standard_stats.png)

### LINES

As read from Game itself.

### LEVEL

As read from game itself.

### Efficiency (EFF)

The score per lines ignoring the level multiplier. Individual clears have score per lines of: 40 for a single, 50 for a double, 100 for a triple, 300 for a tetris

Definition from [TAUS (Tetris - Actually Useful Statistics) rom](https://www.romhacking.net/hacks/4646/) released by talented programmer [Ejona](https://github.com/ejona86), who is also the author of the awesome [2 player mod](https://www.romhacking.net/hacks/5076/)!

### BRN

How many line clears since the last tetris.


## Tetris Rate

![Tetris Rate](./stats/tetris_rate.png)

This shows the tetris rate with the same value as what is computed in the Lines box. It also shows the running Tetris rate based on the past line clear events. Ech line clea event is a dot in the graph, color coded based as described at the start of the document.

This graph is aslo a timeline, BUT, it is not a timeline on the same timescale as the DAS and HEIGHT graphs. Line clear events are show here as one dot each, but they are separated in time by long periods. To see the line clear with the correct time spacing, check the HEIGHT section.

Exampe of Tetris rate showing all 4 types of line clear events

![Tetris rate with all colors](./stats/tetris_rate_all_colors.png)


## Player Video

![Video](./stats/video.png)

So you all can see me when I bang my head against the wall and cry.


## Chat

![Chat](./stats/chat.png)

Shows the twitch chat (last few messages only, because there's no space left in the UI)

I typically do not read this, messages are read to me during a game by my Text-to-Speech system, and I answer by talking back.

Each chatter is randomly assigned both a color and a voice that he/she keeps for the whole session.

The voices are picked based on the following selection from Google Voice's offering. Do not complain about what voice you get!

```javascript
[
	'en-AU-Wavenet-A',
	'en-AU-Wavenet-B',
	'en-AU-Wavenet-C',
	'en-AU-Wavenet-D',

	'en-GB-Wavenet-A',
	'en-GB-Wavenet-B',
	'en-GB-Wavenet-C',
	'en-GB-Wavenet-D',

	'en-IN-Wavenet-A',
	'en-IN-Wavenet-B',
	'en-IN-Wavenet-C',
	'en-IN-Wavenet-D',

	'en-US-Wavenet-A',
	'en-US-Wavenet-B',
	'en-US-Wavenet-C',
	'en-US-Wavenet-D',
	'en-US-Wavenet-E',
	'en-US-Wavenet-F',
]
```

I **can** permanently assign a voice to a twitch user, but you need to be a regular for this to happen. So far only one twitch player has that priviledge (beside myself of course), [Puffy](https://www.twitch.tv/puffie_)!
