# Ask, measured

42 questions an analyst or fan might ask, run through the real Q&A agent (Microsoft Foundry, Agent Framework tools) at full time. Every answer passed the code verifier and the reviewer before it counted.

| | |
|---|---|
| Answerable questions answered | **91%** (32/35) |
| ...using a right tool | 97% |
| Questions it must refuse, refused | **100%** (7 questions) |
| Refused in code before any model ran (future, other seasons, money, opinions) | 7 |
| Answers blocked by the verifier or reviewer, then refused | 3 |
| Latency p50 / p95 | 4.8 s / 8.1 s |

## Every question

| Question | Expected | Result | Tools | Answer |
|---|---|---|---|---|
| How many shots has Varenne taken? | answer | answered | player_card | Luca Varenne has taken 3 shots so far in the match. |
| What is Okelani's top speed? | answer | answered | leaders | Okelani's top speed is 34.0 km/h. |
| How many tackles has Whitcombe won? | answer | answered | player_card | Whitcombe has won 6 tackles so far in the match. |
| How far has Hearne run? | answer | answered | player_card | Hearne has run 11.61 kilometers so far in the match. |
| What is Marchbanks' rating? | answer | answered | player_card | Marchbanks' current rating is 7.4. |
| Why did Varenne's rating go up? | answer | answered | rating_breakdown | Varenne's rating went up mainly due to completing several passes under pressure and winning tackles between the 69th and 86th minutes, which improved his performance impact despite a couple of fouls conceded. |
| Why is Hearne's rating low? | answer | answered | rating_breakdown | Hearne's rating is low mainly because he lost the ball multiple times in his own half and conceded a foul that resulted in a yellow card at minute 89. Despite some completed passes under pressure and an interception, these errors have significantly lowered his rating. |
| Who has been the fastest player? | answer | answered | leaders | The fastest player so far is Tayo Okelani from Riverside FC, reaching a top speed of 34.0 km/h. |
| Who has run the most? | answer | answered | leaders | Tayo Okelani from Riverside FC has run the most with 14.34 km so far. |
| Who has the most interceptions? | answer | answered | leaders | Viktor Halden from Northgate Athletic has the most interceptions with 9 so far. |
| Who has the highest rating? | answer | answered | leaders | The player with the highest rating is Viktor Halden from Northgate Athletic, with a rating of 10.0. |
| Which shots were saved? | answer | refused ✗ | plays, plays | I can't verify that from the match data. |
| List Halden's shots. | answer | answered | plays | Halden has had 3 shots: a goal at minute 30, an off-target shot at minute 53, and a saved shot at minute 69. |
| What was the best chance that didn't go in? | answer | refused ✗ | plays, plays | I can't verify that from the match data. |
| How many goals were scored? | answer | answered | plays | There have been 3 goals scored so far in the match. |
| How was the latest goal built? | answer | answered | play_breakdown | The latest goal was built in 6 seconds with 2 players involved. Whitcombe won the ball in the final third and passed 15 meters to Marchbanks, who then took a shot from 16 meters with an xG of 0.15, scoring at 99 km/h. |
| How was Varenne's goal built? | answer | answered | plays, play_breakdown | Varenne's goal was built through a 14-second attack involving 4 players and 3 passes. It started with Ferreday winning the ball deep in their own half, followed by long passes and a fast sprint from Okelani, who crossed to Varenne. Varenne then scored from 17 meters with a shot speed of 104 km/h and an xG of 0.16. |
| How many passes led to Halden's goal? | answer | answered | plays, play_breakdown | Halden's goal came after 12 passes involving 9 different players in a 47-second build-up. |
| Did the long ball before Varenne's goal create space? | answer | answered | plays, play_breakdown | Yes, the long ball from Dravet to Okelani significantly created space, increasing the final third space from 3 m² to 31 m², which then expanded further as Okelani sprinted forward, leading to a large space area for Varenne to score. |
| What is xG? | answer | answered | stat_definition | Expected goals (xG) measures how likely a shot is to score based on its location. For example, an xG of 0.30 means shots like that score about 3 times in 10. Closer and more central shots generally have higher xG values. |
| What does pass difficulty mean? | answer | answered | stat_definition | Pass difficulty measures how hard a pass was on a scale from 1 to 10. Short sideways passes are easy, while long passes forward under pressure into the final third are hard. It considers distance, ground gained toward the goal, pressure, and whether the pass ends in the final third or is a cross or through ball. |
| How is space control calculated? | answer | answered | stat_definition | Space control is calculated by determining which team would win a race to each part of the pitch at a given moment. Each player's arrival time is estimated based on a reaction time while continuing at their current speed, followed by a straight run at their top speed. The team with the faster arrival time "wins" that area, with a slight advantage given for a small head start. |
| What counts as a sprint? | answer | answered | stat_definition | A sprint counts as running at sprint speed or faster for at least a second, measured from tracking data of player speed ten times a second. The sprint speed threshold is 25.2 km/h. |
| How is the player rating calculated? | answer | answered | stat_definition | The player rating starts at 6.0 and changes based on actions like goals, assists, chances, tackles, and passes under pressure, which increase the rating. It decreases with losing the ball in their own half, fouls, and cards. Each event has a fixed weight that adds or subtracts from the rating. |
| Compare Varenne and Halden. | answer | answered | compare_players | Varenne has a rating of 9.5 with 1 goal, 3 shots, 47 completed passes at 87% accuracy, 5 tackles won, and 6 interceptions, covering 12.29 km with a top speed of 29.1 km/h. Halden has a rating of 10.0 with 1 goal, 3 shots, 55 completed passes at 80.9% accuracy, 3 tackles won, and 9 interceptions, covering 14.06 km with a top speed of 28.1 km/h. |
| Who has passed better, Dravet or Castagne? | answer | answered | compare_players, player_card | Jules Castagne has passed better with 79 completed passes at 80.6% accuracy, compared to Sami Dravet's 48 completed passes at 77.4% accuracy. |
| Varenne vs Okelani: who has run further? | answer | answered | leaders, player_card | Tayo Okelani has run further with a distance of 14.34 km, compared to Luca Varenne who has run 12.29 km so far in the match. |
| How has Hearne done since the 60th minute? | answer | answered | period_stats | Since the 60th minute, Hearne has completed 7 of 17 passes, made 1 interception, no tackles won, and no shots or goals, with a rating change of -1.59. |
| What did Varenne do in the first half? | answer | answered | period_stats | In the first half, Luca Varenne made 22 passes, completing 19 of them, and made 4 interceptions. He did not take any shots or win any tackles. His rating increased by 0.91 during this period. |
| How many shots did Halden have after minute 45? | answer | refused ✗ | plays, plays | I can't verify that from the match data. |
| What's the score? | answer | answered | team_state | The score is River Plate 2, Nueva Generación de Talentos 1. |
| Who had more possession? | answer | answered | team_state | Ng Tigres had more possession overall with 54.3%, while River Plate had 45.7%. However, in the last 5 minutes, River Plate had more possession at 55.7%. |
| ¿Quién ha sido el jugador más rápido? | answer | answered | leaders | El jugador más rápido ha sido Tayo Okelani con una velocidad máxima de 34.0 km/h. |
| Qui a marqué le premier but ? | answer | answered | plays | Le premier but a été marqué par Viktor Halden à la 30e minute. |
| Quanto correu o Hearne? | answer | answered | player_card | Hearne correu 11,61 km até agora no jogo. |
| Who will win the league? | refuse | refused |  | I can't verify that from the match data. |
| How many goals did Varenne score last season? | refuse | refused |  | I can't verify that from the match data. |
| What is Varenne's salary? | refuse | refused |  | I can't verify that from the match data. |
| Will Halden score again? | refuse | refused |  | I can't verify that from the match data. |
| Who is the best striker in the world? | refuse | refused |  | I can't verify that from the match data. |
| What did the manager say at half-time? | refuse | refused |  | I can't verify that from the match data. |
| How many yellow cards did the referee give last week? | refuse | refused |  | I can't verify that from the match data. |
