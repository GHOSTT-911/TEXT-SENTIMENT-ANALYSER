# Sentiment & Emotion Analysis of Code-Mixed Hinglish Text using a Hybrid Rule-Based and Machine Learning Approach

*B.Tech Major Project Report (Draft)*
Department of Computer Science & Engineering · Session 2026–27

> **How to use this draft:** text in [square brackets] must be replaced with your details or results.
> Numbers must come from your own dataset (Evaluation page → Export results CSV, or `ml/results/`).
> Rewrite sections in your own words; examiners can tell when a report is copied unchanged.

---

## Certificate / Declaration / Acknowledgement
[Use your college's standard format.]

## Abstract
Indian social-media users frequently write in *Hinglish*, a code-mixed blend of Hindi and English written in
Roman script (e.g. "movie acchi nahi thi but songs mast the"). Conventional sentiment analysers are built for
English and fail on such text because they neither recognise Romanised Hindi vocabulary and its many spelling
variants, nor handle Hindi's post-positional negation ("accha **nahi**"). This project presents *Neon Pulse*, a
system that classifies Hinglish and English text as Positive, Neutral or Negative and detects eight basic emotions.
We (i) construct a Hinglish-aware sentiment lexicon with spelling normalisation, pre- and post-negation handling and
intensifiers; (ii) train Multinomial Naive Bayes and Logistic Regression classifiers on a manually labelled corpus of
[N] Hinglish comments collected from [sources]; and (iii) propose a hybrid model fusing rule-based and probabilistic
outputs. Using stratified [k]-fold cross-validation, the English-only baseline achieved [x]% accuracy, while the
[best model] achieved [y]% accuracy and [z]% macro-F1. The system is delivered as a privacy-preserving, fully
client-side web dashboard with batch processing, comparison and analytics modules.

**Keywords:** sentiment analysis, code-mixing, Hinglish, lexicon, Naive Bayes, logistic regression, emotion detection

---

## 1. Introduction
### 1.1 Background
Sentiment analysis determines the opinion expressed in text. It underpins product-review mining, brand monitoring
and public-opinion research. In India, over [cite statistic] of social-media content is code-mixed.

### 1.2 Problem Statement
Existing tools (e.g. VADER, TextBlob) are trained or designed for monolingual English. On Hinglish they:
- ignore Hindi sentiment words (*bakwas, zabardast, bekaar*), predicting *Neutral*;
- mis-handle negation that follows the word (*acchi nahi thi* = "was not good");
- fail on spelling variants (*bahut / bahot / bhot / bohot*).

### 1.3 Objectives
1. Build a labelled Hinglish sentiment dataset of [N] comments.
2. Design a Hinglish-aware rule-based sentiment engine.
3. Train and compare ML classifiers on the dataset.
4. Propose and evaluate a hybrid rule + ML model.
5. Deliver an interactive, privacy-preserving analytics application.

### 1.4 Scope and Limitations
Roman-script Hinglish and English only; Devanagari is detected but not analysed. Sarcasm is not explicitly modelled.

## 2. Literature Survey
[Summarise 8–12 papers. Suggested starting points to search for on Google Scholar:]
- Hutto & Gilbert (2014), *VADER: a parsimonious rule-based model for sentiment analysis of social media text*
- Pang, Lee & Vaithyanathan (2002), *Thumbs up? Sentiment classification using machine learning techniques*
- Joshi et al. (2016), *Towards sub-word level compositions for sentiment analysis of Hindi-English code-mixed text*
- Patra et al. (2018), *Sentiment analysis of code-mixed Indian languages: an overview of SAIL_Code-Mixed shared task*
- Patwa et al. (2020), *SemEval-2020 Task 9: Overview of sentiment analysis of code-mixed tweets* (SentiMix)
- Plutchik (1980), *A general psychoevolutionary theory of emotion*

| Paper | Approach | Language | Result | Gap |
|---|---|---|---|---|
| [ ] | [ ] | [ ] | [ ] | [ ] |

> Verify every citation yourself before including it.

## 3. System Analysis
### 3.1 Existing System
[English-only lexicon tools; cloud APIs that send user data to third-party servers.]
### 3.2 Proposed System
Hinglish-aware hybrid engine running entirely in the browser.
### 3.3 Requirements
**Hardware:** any PC with 4 GB RAM. **Software:** modern web browser; optional Node.js 18+, Python 3.10+ with scikit-learn.

## 4. System Design
### 4.1 Architecture
Input layer → Language identification & normalisation → Rule engine → ML engine → Hybrid fusion → Emotion & statistics → Visualisation.
*(Screenshot the animated architecture diagram from the About page.)*

### 4.2 Modules
| Module | File | Description |
|---|---|---|
| Language ID | `language.js` | Detects English / Hinglish / Roman Hindi; normalises spelling variants |
| Rule engine | `sentiment.js` | ~290 English + ~180 Hinglish weighted entries, negation, boosters, contrast rule |
| Emotion engine | `emotion.js` | Plutchik's 8 emotions, Hinglish terms, post-negation aware |
| ML engine | `ml.js` | Naive Bayes, Logistic Regression, Hybrid, k-fold evaluation |
| Analytics | `textstats.js` | Sentences, keywords, Flesch readability |
| UI | `analyzer.js`, `batch.js`, `compare.js`, `dashboard.js`, `evaluation.js` | Dashboard modules |
| API | `backend/server.js` | REST endpoint `POST /api/analyze` |

### 4.3 Diagrams
[Add: DFD level 0/1, use-case diagram, sequence diagram for "analyse text".]

## 5. Methodology
### 5.1 Dataset
- Sources: [YouTube / Instagram / Play Store], collected [dates]
- Size: [N] comments, [P/Nu/Ng] per class, [domains]
- Annotation: two annotators, guidelines in `docs/DATA_COLLECTION_GUIDE.md`; agreement κ = [ ]

### 5.2 Preprocessing
Lower-casing, character-repetition collapse (*bahuuut → bahuut*), spelling-variant normalisation (*bhot → bahut*), tokenisation of words, emoji and emoticons.

### 5.3 Rule-Based Engine
Each token receives valence *v ∈ [−4, +4]*. Intensifiers multiply (*bahut* ×1.6, *thoda* ×0.6).
Negation: English pre-negation window of 3 tokens and Hindi post-negation look-back of 3 tokens, both ×(−0.75).
Contrast words (*but, lekin, magar*) halve preceding scores and amplify following ones ×1.5.
Compound score: **c = x / √(x² + 15)**; label Positive if c ≥ 0.05, Negative if c ≤ −0.05.

### 5.4 Machine Learning Models
Features: normalised unigrams + bigrams.
- **Multinomial Naive Bayes** with Laplace smoothing (α = 1).
- **Logistic Regression** (softmax) on log-scaled TF-IDF vectors, SGD with L2 regularisation.

### 5.5 Hybrid Model
P_hybrid = 0.4·P_rules + 0.6·P_NB, where P_rules is derived from the compound score; label = argmax.

### 5.6 Evaluation Protocol
Stratified [k]-fold cross-validation with fixed seed; metrics: accuracy, macro precision/recall/F1, confusion matrix.

## 6. Results
### 6.1 Overall Comparison
| Engine | Accuracy (%) | Macro F1 (%) |
|---|---|---|
| English lexicon (baseline) | [ ] | [ ] |
| Hinglish-aware lexicon | [ ] | [ ] |
| Naive Bayes | [ ] | [ ] |
| Logistic Regression | [ ] | [ ] |
| Hybrid (rules + NB) | [ ] | [ ] |
| *(Python)* Linear SVM | [ ] | [ ] |

### 6.2 Confusion Matrices
[Insert images from the Evaluation page or `ml/results/confusion_*.png`.]

### 6.3 Error Analysis
[Pick 5–8 misclassified examples from the Evaluation page. Group them: sarcasm, unseen spelling, mixed opinion, domain words.]

### 6.4 Discussion
[Why did the best model win? Where do rules beat ML (small data, explainability) and vice-versa (unseen vocabulary)?]

## 7. Implementation & Screenshots
[Analyzer, Batch, Compare, Dashboard, Evaluation, About; one paragraph each.]

## 8. Testing
| Test | Input | Expected | Result |
|---|---|---|---|
| Hindi post-negation | "movie acchi nahi thi" | Negative | Pass |
| Spelling variant | "bhot badiya" | Positive | Pass |
| Contrast rule | "camera mast hai but battery bekaar" | Negative | Pass |
| Neutral fact | "match kal 7 baje hai" | Neutral | Pass |
| API validation | malformed JSON | HTTP 400 | Pass |
Automated tests: `node backend/test.js`.

## 9. Conclusion & Future Scope
[Summarise improvements over baseline.] Future work: transformer models (mBERT / IndicBERT / MuRIL) fine-tuned on
the dataset, sarcasm detection, Devanagari support, aspect-based sentiment, live social-media monitoring.

## References
[IEEE format. Verify every reference.]

## Appendix
A. Labelling guidelines · B. Sample of dataset · C. Code listing of core algorithm
