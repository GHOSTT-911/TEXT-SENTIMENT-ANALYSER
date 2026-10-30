# Neon Pulse v3 — Hinglish Sentiment & Emotion Analysis

**Sentiment & Emotion Analysis of Code-Mixed Hinglish Text using a Hybrid Rule-Based and Machine Learning Approach**

Classifies English and Hinglish text ("movie acchi nahi thi but songs mast the") as Positive / Neutral / Negative,
detects 8 emotions, and compares five engines (English lexicon baseline, Hinglish-aware lexicon,
Naive Bayes, Logistic Regression, Hybrid) with proper cross-validated evaluation.
Runs 100% in the browser: no installs, works offline, no data leaves your PC.

## Run it
**Easiest:** double-click `index.html`.

**Local server + REST API (Node.js 18+):** double-click `start-server.bat` → http://localhost:3000

**Tests:** `node backend\test.js`

## Your next steps (team checklist)
1. **Collect & label 600–2,000 real Hinglish comments.** Follow `docs/DATA_COLLECTION_GUIDE.md`, starting from `data/my_dataset_template.csv`.
2. **Evaluate:** app → *Evaluation* → *Upload labelled CSV*.
3. **Make it the default dataset:** `node backend\build-dataset.js data\my_dataset.csv`
4. **Report figures (Python):** `pip install -r ml\requirements.txt` then `python ml\train_model.py data\my_dataset.csv` → `ml\results\`
5. **Write the report** from `docs/PROJECT_REPORT_DRAFT.md` using *your* numbers.
6. **Edit team names** in `index.html` (search "Student Name").

> ⚠ `data/sample_hinglish_dataset.csv` (210 rows) is a demo set written to test the pipeline. The Hinglish word
> list was built alongside it, so the rule engine's score on it is inflated. Report results only from your own data.

## What's new in v4
- **New look:** light-green "field notebook" theme (paper texture, ink outlines, highlighter marks, handwritten notes). Night mode is a dark green version. Toggle at the bottom of the sidebar.
- **Why this verdict?** Removes each word in turn and re-scores the text, so you can see exactly which words (including *nahi*, *bahut*, *but*) moved the score.
- **Topic-wise sentiment:** finds topics such as camera, battery, price, delivery, acting, songs, food and gives each its own verdict.
- **Sarcasm & mixed signals:** rule-based check for eye-roll emoji, ironic phrases ("oh great", "wah re…", "kya baat hai") and praise next to complaints, with the reasons listed.
- **Mood card:** downloads a shareable PNG summary of an analysis.
- **Command palette:** press **Ctrl + K** anywhere to jump to a page, switch theme, load samples or export.
- **Live mood ink:** the text box margin changes colour as you type.
- Fix: emoji are no longer flipped by a nearby *nahi* ("help nahi ki 😡" now stays negative).

## Modules
| # | Module | Highlights |
|---|---|---|
| 01 | Analyzer | Language detection, verdict + gauge + mood face, ML second opinion, emotion radar, sentence timeline, word cloud, export |
| 02 | Batch | CSV upload, language column, distribution, sortable table, CSV export |
| 03 | Compare | Two texts head-to-head |
| 04 | Dashboard | History analytics, mood trend, activity heatmap |
| 05 | Evaluation | 5 engines × k-fold CV: accuracy, precision, recall, macro-F1, confusion matrices, error analysis, learned features, live playground |
| — | About | Abstract, architecture, algorithm, team |

Shortcuts: `Ctrl+Enter` analyze · `Alt+1…6` switch module.

## Project structure
    data/sample_hinglish_dataset.csv   demo labelled data (replace with yours)
    data/my_dataset_template.csv       template for your collection
    docs/DATA_COLLECTION_GUIDE.md      how to collect & label, inter-annotator agreement
    docs/PROJECT_REPORT_DRAFT.md       full report skeleton
    ml/train_model.py                  scikit-learn experiments (NB, LR, SVM) + figures
    backend/server.js                  optional server + POST /api/analyze
    backend/build-dataset.js           bundle a CSV into the app
    backend/test.js                    automated tests
    index.html, css/styles.css         the web app (this is what gets deployed)
    js/language.js                     language ID + Hinglish spelling normalisation
    js/sentiment.js                    rule engine (English + Hinglish, pre/post negation)
    js/emotion.js                      8-emotion engine
    js/ml.js                           Naive Bayes, Logistic Regression, Hybrid, cross-validation
    js/dataset.js                      bundled dataset (generated)
    js/*.js                            UI modules, charts, effects

## Privacy & safety
No external libraries (hand-built SVG charts), a Content-Security-Policy blocks all outgoing data, history stays in
your browser, the server only listens on 127.0.0.1. Voice input uses the browser's speech service and only runs when you click the mic.
