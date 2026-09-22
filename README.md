# Rainbow Six Siege Draft Pick Helper

This is a local browser app that ranks available operators for an open Attack or Defense slot. Drag operator icons into the team boxes, select which side has the open slot, and recommendations appear after its first pick. The app shows only the top three model-supported recommendations. You can generate a randomized five-operator team for the closed side. It reports relative model scores only; it never reports a probability or predicts the match winner.

## What the score means

The model is logistic regression over completed rounds. It learns a coefficient for each operator on its playable side, same-side operator pairs, and each attacker-versus-defender pair. For an open slot it adds the candidate's main effect, its same-side pair effects against the allies entered, and its matchup effects against the opponents entered. Defense-side effects are oriented toward the defending team's success. Map/site are not inputs. Recommendations remain hidden until at least one operator is placed on the open side.

The score is a change in fitted log-odds units used only to order choices. It is not converted to a win percentage. Coefficients are associations in historical match data; they are not proof that an operator caused a round to be won. The board includes a current roster, but operators without model coefficients are marked and omitted from recommendations.

## Current-game data status

The trained main, ally, and matchup coefficients still come from the 2017-era round dataset described below. Ubisoft's latest published operator win-delta charts found for this update are for Y11S2.3, included in the Y11S3 Designer's Notes; they are image charts rather than round-level data. They do not include the team compositions required to retrain ally and counter-pick effects. The current patch on Sep 22, 2026 is Y11S3.1. The app links the Ubisoft chart and labels the model's date limits in its data panel. It does not claim current-meta accuracy. A future refresh needs a licensed/public current round dataset with complete ten-player compositions and outcomes, or machine-readable current operator stats plus clearly separated interaction estimates.

Operator icons are loaded from the community [r6operators](https://github.com/marcopixel/r6operators) package via unpkg. Internet access is needed to display them.

## Important dataset note

Do not assume every file named “S5” is the same season. Ubisoft’s [Data Peek article](https://www.ubisoft.com/en-gb/game/rainbow-six/siege/news-updates/2fQ8bGRr6SlS7B4u5jpVt1/introduction-to-the-data-peek-velvet-shell-statistics) describes its `dataDump_S5.csv` as a sample from Year 2 Season 1 and warns that the detailed extract is 19.3 GB. A separate [Kaggle listing](https://www.kaggle.com/datasets/maxcobra/rainbow-six-siege-s5-ranked-dataset) calls a dataset “Season 5.” Check the exact season and its column names before training. Recommendations always describe the dataset you trained on, not today's game balance.

## Setup on Windows

1. Install Python 3.11 or newer from [python.org](https://www.python.org/downloads/). During setup, enable **Add Python to PATH**.
2. Open PowerShell in this project folder. Create an isolated Python environment:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   If PowerShell blocks activation, run this once in that PowerShell window and activate again: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.
3. Install the libraries:

   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. Download the chosen Kaggle dataset into the local-only `data/raw/` folder:

   ```powershell
   .\download_kaggle_data.ps1
   ```

   The public dataset consists of 22 compressed files (about 19 GB of CSV data when extracted). It can take a while and needs that much free disk space. The download script skips CSV chunks already extracted. Do not commit or share these raw files.
5. Convert the raw player rows to one row per round:

   ```powershell
   python prepare_rounds.py "data\raw\*.csv" --output data\rounds.csv --sample 200000
   ```

   `--sample 200000` makes an initial model from a random 10% scan subset capped at 200,000 rounds. Omit it to process every round; this takes considerably longer and can use substantial disk space. DuckDB uses `work\duckdb_temp` for temporary spill files. Increase `--memory-limit` only if your computer has enough free memory.
6. Train the model:

   ```powershell
   python train_model.py --input data\rounds.csv --data-label "Season 5, platform and sample details here"
   ```

7. Start the app:

   ```powershell
   python app.py
   ```

   Open `http://localhost:8501` if the browser does not open automatically. Choose the side with the open slot. Drag the known picks into the matching side's box. Press **Random 5 for closed side** to make a test team. **Reset board** clears both teams.

## Data format and checks

The converter expects the raw file to have columns named `platform`, `matchid`, `roundnumber`, `role`, `operator`, and `winrole`, as described in Ubisoft's detailed-dump schema. The converter combines the five player rows per side into `attack_ops` and `defense_ops`; the trainer expects that resulting CSV to have:

| Column | Meaning |
| --- | --- |
| `attack_ops` | `|` separated list of attackers, such as `Ash|Thermite|Thatcher` |
| `defense_ops` | `|` separated list of defenders |
| `attack_won` | `1` if attackers won the round, otherwise `0` |

If the raw dataset you downloaded uses different headings, first inspect its header with `Get-Content data\yourfile.csv -TotalCount 1`, then adapt the SELECT and grouping fields in `prepare_rounds.py` to match. Do not train unless each resulting row represents one complete round and the label agrees with the attacker's outcome. `train_model.py` checks that both outcome values appear.

The first training run is a practical baseline, not a validated competitive model. Later, you can compare held-out log loss and ranking stability, tune regularization, and examine uncertainty for rare operator pairs. The app deliberately uses only the explicit model decomposition described above.

## Project files

- `app.py` — local static web server.
- `index.html`, `style.css`, `app/board.js` — drag-and-drop draft board and live ranking.
- `prepare_rounds.py` — aggregates player-level CSV rows into one row per round with DuckDB.
- `train_model.py` — fits logistic regression and writes `model/model.json`.
- `model/model.json` — generated coefficients; created only after training.

