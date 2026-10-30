# Data Collection & Labelling Guide

Your own labelled dataset is the most valuable part of this project. It is what turns
"we built an app" into "we measured something new". Follow this guide as a team.

## Target
| | Minimum | Good | Excellent |
|---|---|---|---|
| Total comments | 600 | 1,000 | 2,000+ |
| Per class (Positive / Neutral / Negative) | 200 each | ~330 each | balanced |
| Domains | 3 | 5 | 6+ |

Aim for roughly equal numbers of each label. If one class is much smaller, the models will be biased.

## Where to collect
- **YouTube comments** on Hindi movie trailers/reviews, cricket highlights, phone review channels, food vloggers
- **Instagram / X (Twitter)** replies on Indian brand posts (Zomato, Swiggy, Flipkart, airlines, telecom)
- **Play Store reviews** of Indian apps (many are written in Hinglish)
- Avoid personal / private chats, and never collect usernames or personal details.

Copy only the comment text. Record the link in `source_url` so you can show provenance.

## File format
Start from `data/my_dataset_template.csv`:

```
text,label,domain,source_url,annotator
"Movie bahut acchi thi",Positive,movies,https://youtube.com/...,A
```

- `label` must be exactly **Positive**, **Negative** or **Neutral**
- Keep the original spelling (bahot, bhot, acha…). Don't "correct" Hinglish, because the variety is the point
- Keep emojis
- Remove exact duplicates

## Labelling rules (agree on these before you start)
| Label | Rule | Examples |
|---|---|---|
| **Positive** | Overall opinion is favourable, praise, happiness, recommendation | "camera zabardast hai", "maza aa gaya" |
| **Negative** | Overall opinion is unfavourable, complaint, anger, sadness | "paisa barbaad", "service accha nahi tha" |
| **Neutral** | Facts, questions, announcements, no clear opinion | "match kal 7 baje hai", "price kitna hai?" |

- **Mixed comments:** label by the *dominant / final* opinion ("acting acchi thi but movie boring" → Negative).
- **Sarcasm:** label the *intended* meaning ("wah kya service hai, 2 ghante late 🙄" → Negative). Note these; they make great error-analysis examples.
- **Spam / non-Hindi-English / unreadable:** skip it.

## Measure agreement (examiners love this)
1. Have **two team members label the same 100 comments independently**.
2. Count how often they agree → *percentage agreement*.
3. Better: compute **Cohen's kappa** (κ). Online calculators exist, or ask Claude to compute it from your two label columns.
   κ > 0.6 is "substantial agreement" and is worth stating in the report.
4. Discuss disagreements, refine the rules, then label the rest.

## Using your dataset in the project
1. Save as `data/my_dataset.csv`.
2. **Quick test:** open the app → *Evaluation* → *Upload labelled CSV*. Results appear instantly.
3. **Make it the default** (so the ML second opinion in the Analyzer uses it too):
   ```
   node backend/build-dataset.js data/my_dataset.csv
   ```
4. **Python results & figures for the report:**
   ```
   pip install -r ml/requirements.txt
   python ml/train_model.py data/my_dataset.csv
   ```
   Figures and tables are saved in `ml/results/`.

## Important: keep the evaluation honest
The bundled `sample_hinglish_dataset.csv` was written to test the pipeline, and the Hinglish word list
was built at the same time, so the rule engine scores unrealistically high on it.
**Only report numbers from your own collected data.** If the rule engine misses words that are common
in your data, you may extend the lexicon, but then re-test on a fresh held-out set it has never seen
(e.g. the last 20% you collected), and say so in the report.
