# Job Titles & Skills Datasets (External)

The job posting form loads **`/data/job-titles-skills.json`** for the title and skills pickers. You can build this file from one or more of the sources below. **Duplicate job titles are merged** when using multiple datasets (same title → union of skills).

---

## Dataset comparison

| Source | Scope | Best for |
|--------|--------|----------|
| **O*NET** (U.S. Dept of Labor) | 900+ occupations, KSAs + Tools & Technology | Authoritative, professional skill-to-job mapping |
| **ESCO** (European Commission) | 3,000 occupations, 13,800 skills, multilingual | Hierarchical taxonomy, EU/global roles |
| **Kaggle** (real-world postings) | 1.3M+ LinkedIn, 55+ roles, etc. | Actual job ad wording and skills |

You can use **one or combine several**; the merge script deduplicates by job title (case-insensitive) and unions skills.

---

## 1. O*NET (most comprehensive, US-focused)

**Link:** [O*NET Resource Center – Database Download](https://onetcenter.org/database.html)

**What you get:** Tab-delimited text files. Each occupation has an O*NET-SOC code; skills are linked by that code.

**Download:**
- **Occupation data** – e.g. "Alternate Titles" or occupation file that has **O*NET-SOC Code** + **Title** (and optionally Alternate Title).
- **Skills** – file that has **O*NET-SOC Code** + **Element Name** (skill name). From the Data Dictionary this is often column index 0 = code, 2 = Element Name.

**Convert:**

```bash
cd apps/web
node scripts/convert-onet-to-json.js \
  --occupation-file=/path/to/Alternate_Titles.txt \
  --skills-file=/path/to/Skills.txt
```

This writes **`public/data/job-titles-skills-onet.json`**. If your files use different column positions:

```bash
node scripts/convert-onet-to-json.js \
  --occupation-file=/path/to/occupation.txt \
  --skills-file=/path/to/Skills.txt \
  --title-col=1 \
  --code-col=0 \
  --skill-name-col=2
```

---

## 2. ESCO (European, very granular)

**Link:** [ESCO Download](https://esco.ec.europa.eu/en/use-esco/download) (select CSV, choose Occupations + Skills + occupation–skill relationship).

**What you get:** CSV pillar files (occupations, skills) and a **relationship** file linking occupation ID to skill ID.

**Convert:**

```bash
cd apps/web
node scripts/convert-esco-to-json.js \
  --occupations=/path/to/occupations.csv \
  --skills=/path/to/skills.csv \
  --relation=/path/to/occupationSkillRelations.csv
```

Column names are auto-detected (e.g. `conceptUri`, `preferredLabel`). If your CSVs use different headers:

```bash
node scripts/convert-esco-to-json.js \
  --occupations=occ.csv --skills=skills.csv --relation=rel.csv \
  --occ-id=conceptUri --occ-label=preferredLabel \
  --skill-id=conceptUri --skill-label=preferredLabel
```

This writes **`public/data/job-titles-skills-esco.json`**.

---

## 3. Kaggle (real-world postings)

**Examples:**
- [1.3M LinkedIn Jobs & Skills (2024)](https://www.kaggle.com/datasets/asaniczka/1-3m-linkedin-jobs-and-skills-2024) – has a skills column per row.
- [Job Titles & Roles Dataset with Skills](https://www.kaggle.com/datasets/usmohamed/job-titles-and-roles-dataset-with-skills)
- [Job Descriptions 2025 – Tech & Non-Tech](https://www.kaggle.com/datasets) (55+ roles)

**Convert:** One CSV with a job title column and a skills column (skills can be comma/semicolon-separated in one cell).

```bash
cd apps/web
node scripts/convert-kaggle-csv-to-json.js /path/to/linkedin_job_postings.csv \
  --title-col=title \
  --skills-col=skills \
  --output=job-titles-skills-kaggle
```

This writes **`public/data/job-titles-skills-kaggle.json`** (so you can merge it with O*NET/ESCO). To overwrite the **final** file directly instead of merging later, omit `--output`:

```bash
node scripts/convert-kaggle-csv-to-json.js /path/to/file.csv
# writes public/data/job-titles-skills.json
```

---

## 4. Merging multiple datasets (no duplicate titles)

After you have two or more `job-titles-skills-*.json` files (e.g. O*NET, ESCO, Kaggle), merge them into the single file the app loads. **Titles are deduplicated** (case-insensitive); skills for the same title are combined (union).

**Option A – merge all `job-titles-skills-*.json` in `public/data/`:**

```bash
cd apps/web
node scripts/merge-job-datasets.js
```

This finds every `job-titles-skills-*.json` (except `job-titles-skills.json`) in `public/data/` and merges them into **`public/data/job-titles-skills.json`**.

**Option B – merge specific files:**

```bash
node scripts/merge-job-datasets.js \
  public/data/job-titles-skills-onet.json \
  public/data/job-titles-skills-esco.json \
  public/data/job-titles-skills-kaggle.json
```

Output is always **`public/data/job-titles-skills.json`**.

---

## 5. Using the merged file in the app

- The form fetches **`/data/job-titles-skills.json`** (i.e. `public/data/job-titles-skills.json`).
- If the file exists and is valid, the **job title** and **skills** pickers use it.
- If the request fails or the file is missing, the app uses the **embedded fallback** list.

Refresh or restart the app after generating or updating the file.

---

## 6. Suggested workflows

**Single source (e.g. Kaggle only):**
1. Download CSV from Kaggle.
2. Run `convert-kaggle-csv-to-json.js` **without** `--output` so it writes `job-titles-skills.json` directly.

**O*NET + ESCO (authoritative + global):**
1. Download O*NET occupation + skills files; run `convert-onet-to-json.js` → `job-titles-skills-onet.json`.
2. Download ESCO CSVs; run `convert-esco-to-json.js` → `job-titles-skills-esco.json`.
3. Run `merge-job-datasets.js` with no args (or pass the two JSON paths) → `job-titles-skills.json`.

**All three (O*NET + ESCO + Kaggle):**
1. Convert each source to `job-titles-skills-onet.json`, `job-titles-skills-esco.json`, `job-titles-skills-kaggle.json`.
2. Run `merge-job-datasets.js` → single `job-titles-skills.json` with no duplicate job titles and merged skills.
