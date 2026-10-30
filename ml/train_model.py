"""
Neon Pulse - Python ML experiments for the project report.

Trains and evaluates classic ML models on a labelled Hinglish sentiment CSV
using stratified 5-fold cross-validation, and saves report-ready figures.

Usage (from the project folder):
    pip install -r ml/requirements.txt
    python ml/train_model.py                         # uses data/sample_hinglish_dataset.csv
    python ml/train_model.py data/my_dataset.csv     # your collected dataset

Outputs go to ml/results/:
    results_table.csv          accuracy / precision / recall / F1 per model (mean ± std)
    classification_report.txt  per-class report for every model
    confusion_<model>.png      confusion matrix images
    model_comparison.png       bar chart comparing models
"""
import json
import os
import re
import sys

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix,
                             f1_score, precision_score, recall_score)
from sklearn.model_selection import StratifiedKFold
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "results")
LABELS = ["Positive", "Neutral", "Negative"]

# --- Hinglish spelling normalisation (same idea as js/language.js) -------------
VARIANTS = {
    "bahot": "bahut", "bahoot": "bahut", "bhot": "bahut", "bohot": "bahut", "bht": "bahut", "bhut": "bahut", "bohat": "bahut",
    "acha": "accha", "achha": "accha", "acchha": "accha", "achcha": "accha", "acchi": "accha", "achi": "accha",
    "achhi": "accha", "acche": "accha", "ache": "accha", "achhe": "accha",
    "nahin": "nahi", "nhi": "nahi", "nai": "nahi", "h": "hai", "hain": "hai",
    "bakwaas": "bakwas", "bekar": "bekaar", "ghatia": "ghatiya", "faltoo": "faltu", "kharaab": "kharab",
    "jabardast": "zabardast", "zabrdast": "zabardast", "badiya": "badhiya", "bdiya": "badhiya",
    "shandar": "shandaar", "gajab": "gazab", "pyar": "pyaar", "maja": "maza", "mazaa": "maza",
    "thik": "theek", "ekdam": "ekdum", "kafi": "kaafi", "jyada": "zyada", "yar": "yaar",
    "osm": "awesome", "awsm": "awesome", "gud": "good", "plz": "please", "pls": "please",
}
LABEL_MAP = {"positive": "Positive", "pos": "Positive", "1": "Positive",
             "negative": "Negative", "neg": "Negative", "-1": "Negative",
             "neutral": "Neutral", "neu": "Neutral", "0": "Neutral"}


def normalise(text: str) -> str:
    text = text.lower()
    text = re.sub(r"(.)\1{2,}", r"\1\1", text)  # "bahuuuut" -> "bahuut"
    words = re.findall(r"[a-z][a-z']*|[!?]", text)
    return " ".join(VARIANTS.get(w.replace("'", ""), w.replace("'", "")) for w in words)


def load(path):
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    if "text" not in df or "label" not in df:
        sys.exit('CSV needs "text" and "label" columns')
    df["label"] = df["label"].astype(str).str.strip().str.lower().map(LABEL_MAP)
    df = df.dropna(subset=["text", "label"])
    return df["text"].astype(str).tolist(), df["label"].tolist()


def models():
    vec = lambda: TfidfVectorizer(preprocessor=normalise, token_pattern=r"[^ ]+", ngram_range=(1, 2), sublinear_tf=True, min_df=1)
    return {
        "Naive Bayes": Pipeline([("tfidf", vec()), ("clf", MultinomialNB(alpha=0.5))]),
        "Logistic Regression": Pipeline([("tfidf", vec()), ("clf", LogisticRegression(max_iter=2000, C=5))]),
        "Linear SVM": Pipeline([("tfidf", vec()), ("clf", LinearSVC(C=1.0))]),
    }


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "sample_hinglish_dataset.csv")
    X, y = load(path)
    X, y = np.array(X, dtype=object), np.array(y)
    os.makedirs(OUT, exist_ok=True)
    counts = {l: int((y == l).sum()) for l in LABELS}
    print(f"Dataset: {os.path.basename(path)}  rows={len(X)}  {counts}")
    if "sample_hinglish_dataset" in path:
        print("NOTE: this is the bundled SAMPLE dataset. Use your own collected data for the report.\n")

    k = min(5, min(counts.values()))
    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=42)
    rows, report_lines = [], []
    for name, model in models().items():
        accs, precs, recs, f1s = [], [], [], []
        y_true_all, y_pred_all = [], []
        for tr, te in skf.split(X, y):
            model.fit(X[tr], y[tr])
            pred = model.predict(X[te])
            accs.append(accuracy_score(y[te], pred))
            precs.append(precision_score(y[te], pred, average="macro", zero_division=0))
            recs.append(recall_score(y[te], pred, average="macro", zero_division=0))
            f1s.append(f1_score(y[te], pred, average="macro", zero_division=0))
            y_true_all += list(y[te])
            y_pred_all += list(pred)
        rows.append({
            "model": name,
            "accuracy": f"{np.mean(accs)*100:.1f} ± {np.std(accs)*100:.1f}",
            "precision": f"{np.mean(precs)*100:.1f}",
            "recall": f"{np.mean(recs)*100:.1f}",
            "macro_f1": f"{np.mean(f1s)*100:.1f} ± {np.std(f1s)*100:.1f}",
            "_acc": float(np.mean(accs)), "_f1": float(np.mean(f1s)),
        })
        report_lines.append(f"=== {name} ({k}-fold CV, pooled predictions) ===\n"
                            + classification_report(y_true_all, y_pred_all, labels=LABELS, digits=3, zero_division=0))
        cm = confusion_matrix(y_true_all, y_pred_all, labels=LABELS)
        fig, ax = plt.subplots(figsize=(4.2, 3.6))
        ax.imshow(cm, cmap="Purples")
        ax.set_xticks(range(3), LABELS)
        ax.set_yticks(range(3), LABELS)
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        ax.set_title(name)
        for i in range(3):
            for j in range(3):
                ax.text(j, i, cm[i, j], ha="center", va="center", color="white" if cm[i, j] > cm.max() / 2 else "black")
        fig.tight_layout()
        fig.savefig(os.path.join(OUT, f"confusion_{name.lower().replace(' ', '_')}.png"), dpi=150)
        plt.close(fig)
        print(f"{name:<22} accuracy {rows[-1]['accuracy']}%   macro-F1 {rows[-1]['macro_f1']}%")

    table = pd.DataFrame(rows)
    table.drop(columns=["_acc", "_f1"]).to_csv(os.path.join(OUT, "results_table.csv"), index=False)
    with open(os.path.join(OUT, "classification_report.txt"), "w", encoding="utf-8") as f:
        f.write(f"Dataset: {os.path.basename(path)}  rows={len(X)}  {json.dumps(counts)}\n\n" + "\n".join(report_lines))

    fig, ax = plt.subplots(figsize=(6, 3.4))
    xs = np.arange(len(rows))
    ax.bar(xs - 0.18, [r["_acc"] * 100 for r in rows], 0.36, label="Accuracy", color="#00b8a9")
    ax.bar(xs + 0.18, [r["_f1"] * 100 for r in rows], 0.36, label="Macro F1", color="#7b61ff")
    ax.set_xticks(xs, [r["model"] for r in rows])
    ax.set_ylim(0, 100)
    ax.set_ylabel("%")
    ax.set_title("Model comparison (cross-validated)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "model_comparison.png"), dpi=150)
    plt.close(fig)
    print(f"\nSaved results to {OUT}")


if __name__ == "__main__":
    main()
