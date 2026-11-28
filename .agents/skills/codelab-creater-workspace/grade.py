#!/usr/bin/env python3
"""
Grade a codelab claat.md output against universal + eval-specific assertions.

Usage:
    python grade.py <output_file_or_dir> <eval_id>

If a directory is given, the first .md file found at any depth is graded.
Writes grading.json to the parent of the output directory.
"""

import json
import re
import sys
from pathlib import Path

# --------- Assertion definitions -----------------------------------------

def assertion_frontmatter_present(text):
    """Frontmatter present with required fields (summary, id, categories, environments, status, author) before the first '# ' heading."""
    head = text.split("\n# ", 1)[0]
    required = ["summary:", "id:", "categories:", "environments:", "status:", "author:"]
    missing = [k for k in required if k not in head]
    return (not missing, f"Missing fields: {missing}" if missing else "All 6 frontmatter fields present")


def assertion_no_yaml_fence(text):
    """Frontmatter uses bare key:value lines (no `---` YAML fence wrapper) — claat format requires this."""
    first_nonblank = next((ln for ln in text.splitlines() if ln.strip()), "")
    if first_nonblank.strip() == "---":
        return (False, "First non-blank line is `---` — claat does not use YAML fences")
    return (True, f"First line is bare key:value (`{first_nonblank[:60]}`)")


def assertion_doc_title(text):
    """Exactly one `# Title` heading appears after the frontmatter."""
    titles = re.findall(r"^# [^#\n].*", text, re.MULTILINE)
    if len(titles) == 1:
        return (True, f"Title: `{titles[0][:80]}`")
    return (False, f"Expected exactly 1 `# Title`, found {len(titles)}")


def assertion_every_step_has_duration(text):
    """Every `## ` step heading is followed within 3 non-blank lines by `Duration: H:MM:SS`."""
    lines = text.splitlines()
    step_lines = [i for i, ln in enumerate(lines) if ln.startswith("## ")]
    missing = []
    for i in step_lines:
        window = "\n".join(lines[i+1:i+6])
        if not re.search(r"Duration:\s*\d+:\d{2}:\d{2}", window):
            missing.append(lines[i][:60])
    if missing:
        return (False, f"Steps missing Duration: {missing}")
    return (True, f"All {len(step_lines)} steps have Duration")


def assertion_no_step_n_prefix(text):
    """Step headers do NOT use `## Step N:` prefix — sidebar auto-numbers (skill convention)."""
    bad = re.findall(r"^## Step\s+\d", text, re.MULTILINE)
    if bad:
        return (False, f"Found {len(bad)} `## Step N:`-style headers: {bad[:3]}")
    return (True, "No `Step N:` prefix in any step header")


def assertion_recap_step(text):
    """Last step is a recap (Congratulations / おめでとう / まとめ / Wrap up / Next steps)."""
    step_titles = re.findall(r"^## (.+)$", text, re.MULTILINE)
    if not step_titles:
        return (False, "No `## ` step headers found")
    last = step_titles[-1]
    recap_words = ["congratulations", "おめでとう", "まとめ", "wrap", "next step", "next steps", "finish", "完了"]
    if any(w in last.lower() for w in recap_words):
        return (True, f"Last step `{last}` matches recap convention")
    return (False, f"Last step `{last}` does not look like a recap")


def assertion_min_step_count(text, minimum=6):
    """At least `minimum` `## ` step headings (intro + setup + ≥content + recap)."""
    n = len(re.findall(r"^## ", text, re.MULTILINE))
    if n >= minimum:
        return (True, f"{n} steps (≥{minimum})")
    return (False, f"Only {n} steps (want ≥{minimum})")


def assertion_step1_has_subsections(text):
    """Step 1 contains 'what-you'll-build / learn / need' style sub-sections (### or bold-label form)."""
    step_starts = [m.start() for m in re.finditer(r"^## ", text, re.MULTILINE)]
    if len(step_starts) < 2:
        return (False, "Less than 2 steps — no Step 1 body to check")
    step1 = text[step_starts[0]:step_starts[1]]
    patterns_build = ["作るもの", "what you'll build", "build", "完成イメージ", "ゴール"]
    patterns_learn = ["学ぶこと", "学習内容", "what you'll learn", "learn", "objectives"]
    patterns_need = ["必要なもの", "what you'll need", "prerequisites", "前提"]
    has_build = any(p.lower() in step1.lower() for p in patterns_build)
    has_learn = any(p.lower() in step1.lower() for p in patterns_learn)
    has_need = any(p.lower() in step1.lower() for p in patterns_need)
    score = sum([has_build, has_learn, has_need])
    if score >= 2:
        return (True, f"Step 1 covers {score}/3 of build/learn/need")
    return (False, f"Step 1 only covers {score}/3 of build/learn/need")


def assertion_code_blocks_have_lang(text):
    """Every fenced code block has a language identifier (```dart, ```bash, etc.)."""
    fences = re.findall(r"^```(\w*)$", text, re.MULTILINE)
    if not fences:
        return (False, "No fenced code blocks found")
    opens = fences[::2]  # every other fence is an opener
    blank = [i for i, lang in enumerate(opens) if not lang]
    if blank:
        return (False, f"{len(blank)}/{len(opens)} code blocks missing language tag")
    return (True, f"All {len(opens)} fenced code blocks have a language tag")


def assertion_has_callout(text):
    """At least one callout box (`> **Note:** / **Tip:** / **Warning:** / **補足:** / **Troubleshooting:** etc.)."""
    keywords = ["Note", "Notice", "補足", "Tip", "Tips", "Hint", "Warning", "Warn", "Caution", "Troubleshooting"]
    pattern = r"^>\s*\*\*(" + "|".join(keywords) + r")(?:\*\*|:)"
    matches = re.findall(pattern, text, re.MULTILINE)
    if matches:
        return (True, f"{len(matches)} callout box(es) found: {set(matches)}")
    return (False, "No `> **Keyword:**`-style callouts")


def assertion_total_duration_in_range(text, target_min, tolerance=0.3):
    """Sum of step Durations is within ±tolerance of target_min minutes."""
    durations = re.findall(r"Duration:\s*(\d+):(\d{2}):(\d{2})", text)
    total_min = sum(int(h)*60 + int(m) + int(s)/60 for h, m, s in durations)
    lo = target_min * (1 - tolerance)
    hi = target_min * (1 + tolerance)
    if lo <= total_min <= hi:
        return (True, f"Total {total_min:.0f} min in target {target_min}±{int(tolerance*100)}% [{lo:.0f}-{hi:.0f}]")
    return (False, f"Total {total_min:.0f} min outside target {target_min}±{int(tolerance*100)}% [{lo:.0f}-{hi:.0f}]")


# Eval-specific
def assertion_contains_japanese(text):
    """Output is in Japanese (contains hiragana/katakana/kanji)."""
    jp_chars = len(re.findall(r"[぀-ゟ゠-ヿ一-鿿]", text))
    if jp_chars >= 200:
        return (True, f"{jp_chars} CJK characters")
    return (False, f"Only {jp_chars} CJK characters — likely not Japanese")


def assertion_contains_english(text):
    """Output is in English (ASCII-dominant, few CJK chars)."""
    jp_chars = len(re.findall(r"[぀-ゟ゠-ヿ一-鿿]", text))
    ascii_words = len(re.findall(r"\b[a-zA-Z]{3,}\b", text))
    if ascii_words >= 200 and jp_chars < 20:
        return (True, f"{ascii_words} English words, {jp_chars} CJK chars")
    return (False, f"{ascii_words} English words, {jp_chars} CJK chars — not English-dominant")


def assertion_mentions(needles):
    """Output mentions all listed terms (case-insensitive)."""
    needles = needles if isinstance(needles, list) else [needles]
    def check(text):
        missing = [n for n in needles if n.lower() not in text.lower()]
        if missing:
            return (False, f"Missing terms: {missing}")
        return (True, f"All terms present: {needles}")
    return check


# --------- Per-eval assertion sets ---------------------------------------

EVAL_ASSERTIONS = {
    0: [
        # Universal
        ("Frontmatter has all 6 required fields", assertion_frontmatter_present),
        ("Frontmatter uses bare key:value (no `---` fence)", assertion_no_yaml_fence),
        ("Exactly one `# Title` document heading", assertion_doc_title),
        ("Every `##` step has `Duration: H:MM:SS`", assertion_every_step_has_duration),
        ("No `## Step N:` prefix in step headers", assertion_no_step_n_prefix),
        ("Last step matches recap convention", assertion_recap_step),
        ("≥6 steps total", lambda t: assertion_min_step_count(t, 6)),
        ("Step 1 covers ≥2 of build/learn/need", assertion_step1_has_subsections),
        ("All fenced code blocks have language tags", assertion_code_blocks_have_lang),
        ("≥1 callout box", assertion_has_callout),
        ("Total Duration ~60 min (±30%)", lambda t: assertion_total_duration_in_range(t, 60, 0.3)),
        # Eval-specific
        ("Output is in Japanese", assertion_contains_japanese),
        ("Mentions Tailwind", assertion_mentions(["Tailwind"])),
    ],
    1: [
        # Universal
        ("Frontmatter has all 6 required fields", assertion_frontmatter_present),
        ("Frontmatter uses bare key:value (no `---` fence)", assertion_no_yaml_fence),
        ("Exactly one `# Title` document heading", assertion_doc_title),
        ("Every `##` step has `Duration: H:MM:SS`", assertion_every_step_has_duration),
        ("No `## Step N:` prefix in step headers", assertion_no_step_n_prefix),
        ("Last step matches recap convention", assertion_recap_step),
        ("≥6 steps total", lambda t: assertion_min_step_count(t, 6)),
        ("Step 1 covers ≥2 of build/learn/need", assertion_step1_has_subsections),
        ("All fenced code blocks have language tags", assertion_code_blocks_have_lang),
        ("≥1 callout box", assertion_has_callout),
        ("Total Duration ~90 min (±30%)", lambda t: assertion_total_duration_in_range(t, 90, 0.3)),
        # Eval-specific
        ("Output is in English", assertion_contains_english),
        ("Mentions manifest, content script, Gemini", assertion_mentions(["manifest", "content script", "Gemini"])),
    ],
    2: [
        # Universal
        ("Frontmatter has all 6 required fields", assertion_frontmatter_present),
        ("Frontmatter uses bare key:value (no `---` fence)", assertion_no_yaml_fence),
        ("Exactly one `# Title` document heading", assertion_doc_title),
        ("Every `##` step has `Duration: H:MM:SS`", assertion_every_step_has_duration),
        ("No `## Step N:` prefix in step headers", assertion_no_step_n_prefix),
        ("Last step matches recap convention", assertion_recap_step),
        ("≥6 steps total", lambda t: assertion_min_step_count(t, 6)),
        ("Step 1 covers ≥2 of build/learn/need", assertion_step1_has_subsections),
        ("All fenced code blocks have language tags", assertion_code_blocks_have_lang),
        ("≥1 callout box", assertion_has_callout),
        ("Total Duration ~90 min (±30%)", lambda t: assertion_total_duration_in_range(t, 90, 0.3)),
        # Eval-specific
        ("Output is in Japanese", assertion_contains_japanese),
        ("Mentions ADK and a Python install/run step", assertion_mentions(["ADK", "pip"])),
    ],
}


# --------- Driver --------------------------------------------------------

def find_md_file(path: Path) -> Path | None:
    if path.is_file() and path.suffix == ".md":
        return path
    if path.is_dir():
        mds = sorted(path.rglob("*.md"))
        if mds:
            return mds[0]
    return None


def grade(output_path_str: str, eval_id: int):
    output_path = Path(output_path_str)
    md = find_md_file(output_path)
    if md is None:
        print(f"  No .md file found under {output_path}")
        text = ""
    else:
        text = md.read_text(encoding="utf-8")

    results = []
    passed_n = 0
    for assertion_text, check_fn in EVAL_ASSERTIONS[eval_id]:
        if not text:
            results.append({"text": assertion_text, "passed": False, "evidence": "No output file found"})
            continue
        try:
            passed, evidence = check_fn(text)
        except Exception as e:
            passed, evidence = False, f"Assertion error: {e}"
        results.append({"text": assertion_text, "passed": passed, "evidence": evidence})
        if passed:
            passed_n += 1

    return {
        "output_file": str(md) if md else None,
        "passed": passed_n,
        "total": len(results),
        "pass_rate": passed_n / len(results) if results else 0.0,
        "expectations": results,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: grade.py <output_dir_or_file> <eval_id>")
        sys.exit(1)
    output = sys.argv[1]
    eval_id = int(sys.argv[2])
    result = grade(output, eval_id)
    print(json.dumps(result, indent=2, ensure_ascii=False))
