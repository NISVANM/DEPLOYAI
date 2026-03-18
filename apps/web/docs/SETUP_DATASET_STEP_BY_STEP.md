# Detailed Instructions: Setting Up Job Titles & Skills Dataset

Follow this guide step by step. Choose **one** of the paths below (easiest = Option A).

---

## Before you start

- Your project root is where `apps/web` lives (e.g. `~/deployai` or `C:\Users\You\deployai`).
- All commands below assume you open a terminal and **go to the web app folder** first:

```bash
cd apps/web
```

(If your project has no `apps/` and the web app is the root, use `cd .` and run scripts as `node scripts/...`.)

---

## Option A: Easiest – Kaggle only (one CSV, no merge)

Use this if you want a **single dataset** from real job postings (e.g. LinkedIn-style).

### Step 1: Create a Kaggle account (if you don’t have one)

1. Go to [kaggle.com](https://www.kaggle.com).
2. Sign up (free).

### Step 2: Download a dataset

1. Open: [1.3M LinkedIn Jobs & Skills (2024)](https://www.kaggle.com/datasets/asaniczka/1-3m-linkedin-jobs-and-skills-2024).
2. Click **Download** (you may need to accept the rules once).
3. Unzip the file. You should see at least one CSV (e.g. `linkedin_job_postings.csv`).
4. Note the **full path** to that CSV, e.g.:
   - Mac/Linux: `/Users/YourName/Downloads/1-3m-linkedin-jobs-and-skills-2024/linkedin_job_postings.csv`
   - Windows: `C:\Users\YourName\Downloads\1-3m-linkedin-jobs-and-skills-2024\linkedin_job_postings.csv`

### Step 3: Check the CSV columns (optional but recommended)

1. Open the CSV in Excel or a text editor.
2. Look at the **first row** (headers). You need:
   - A column for **job title** (often `title`, `job_title`, or `position`).
   - A column for **skills** (often `skills`, `required_skills`, or similar).
3. Remember or write down the **exact** header names (case doesn’t matter for the script).

### Step 4: Run the conversion script

In the terminal (from `apps/web`):

```bash
node scripts/convert-kaggle-csv-to-json.js "FULL_PATH_TO_YOUR_FILE.csv"
```

**Example (Mac):**
```bash
node scripts/convert-kaggle-csv-to-json.js "/Users/niswa/Downloads/1-3m-linkedin-jobs-and-skills-2024/linkedin_job_postings.csv"
```

**Example (Windows, in PowerShell):**
```powershell
node scripts/convert-kaggle-csv-to-json.js "C:\Users\niswa\Downloads\1-3m-linkedin-jobs-and-skills-2024\linkedin_job_postings.csv"
```

If your CSV uses different column names, add them:

```bash
node scripts/convert-kaggle-csv-to-json.js "PATH_TO_FILE.csv" --title-col=job_title --skills-col=required_skills
```

Replace `job_title` and `required_skills` with your actual header names.

### Step 5: Confirm the output

1. The script prints something like: `Wrote X job titles and Y unique skills to .../public/data/job-titles-skills.json`
2. Check that this file exists: **`apps/web/public/data/job-titles-skills.json`**.

### Step 6: Use it in the app

1. If the app is running, **refresh the browser** (or restart `npm run dev` from `apps/web`).
2. Go to **Dashboard → Jobs → Post New Job**.
3. In **Job Title**, start typing: you should see suggestions from the dataset.
4. In **Required Skills**, start typing: you should see skill suggestions. You can still type your own title or skills.

---

## Option B: O*NET only (US occupations, very detailed)

Use this for **official US job titles and skills** (900+ occupations).

### Step 1: Download O*NET database

1. Go to [O*NET Database Download](https://onetcenter.org/database.html).
2. Choose the **latest version** (e.g. 30.x).
3. Download the **Database** (e.g. “Database – Tab-delimited” or “Text”).
4. Unzip. You need **two** files:
   - One that has **occupation codes and titles** (e.g. `Alternate Titles.txt` or an occupation/title file).
   - **Skills.txt** (O*NET-SOC Code + skill names).

Folder structure is often something like:
- `db_30_2_text/Alternate Titles.txt`
- `db_30_2_text/Skills.txt`

Note the **full paths** to these two files.

### Step 2: Run the O*NET converter

From `apps/web`:

```bash
node scripts/convert-onet-to-json.js --occupation-file="FULL_PATH_TO_Alternate_Titles.txt" --skills-file="FULL_PATH_TO_Skills.txt"
```

**Example (Mac):**
```bash
node scripts/convert-onet-to-json.js --occupation-file="/Users/niswa/Downloads/db_30_2_text/Alternate Titles.txt" --skills-file="/Users/niswa/Downloads/db_30_2_text/Skills.txt"
```

### Step 3: Copy output to the file the app uses

The script creates **`public/data/job-titles-skills-onet.json`**. The app reads **`job-titles-skills.json`**, so either:

**A) Rename/copy (one-time):**
```bash
cp public/data/job-titles-skills-onet.json public/data/job-titles-skills.json
```

**B) Or run the merge script (so you can add more datasets later):**
```bash
node scripts/merge-job-datasets.js
```
This merges all `job-titles-skills-*.json` in `public/data/` into `job-titles-skills.json`. With only O*NET, that’s just one source.

### Step 4: Refresh the app

Refresh the browser (or restart the dev server) and test **Post New Job** as in Option A, Step 6.

---

## Option C: ESCO only (European, 3000+ occupations)

Use this for **European / international** job titles and skills.

### Step 1: Download ESCO data

1. Go to [ESCO Download](https://esco.ec.europa.eu/en/use-esco/download).
2. Accept the privacy statement and enter your email; use the download link you receive.
3. In the package, select **CSV** and the **English** (or your language) package.
4. Unzip. You need **three** CSVs:
   - **Occupations** (occupation id + label).
   - **Skills** (skill id + label).
   - A **relationship** file that links occupation id to skill id (often named like “occupationSkillRelations” or “occupation_skill” in the Relationships folder).

Note the full paths to these three files.

### Step 2: Run the ESCO converter

From `apps/web`:

```bash
node scripts/convert-esco-to-json.js --occupations="PATH_TO_occupations.csv" --skills="PATH_TO_skills.csv" --relation="PATH_TO_occupation_skill_relation.csv"
```

**Example:**
```bash
node scripts/convert-esco-to-json.js --occupations="/Users/niswa/Downloads/esco/en/occupations.csv" --skills="/Users/niswa/Downloads/esco/en/skills.csv" --relation="/Users/niswa/Downloads/esco/en/occupationSkillRelations.csv"
```

(Adjust paths to match your ESCO folder and file names.)

### Step 3: Use the output in the app

The script writes **`public/data/job-titles-skills-esco.json`**. Either copy it to the main file:

```bash
cp public/data/job-titles-skills-esco.json public/data/job-titles-skills.json
```

or run the merge (if you have other datasets too):

```bash
node scripts/merge-job-datasets.js
```

Then refresh the app and test **Post New Job**.

---

## Option D: Use more than one dataset (O*NET + ESCO + Kaggle)

Use this when you want **maximum coverage** and no duplicate job titles (titles are merged; skills are combined).

### Step 1: Create one JSON per source

Do **Option A** (Kaggle), **Option B** (O*NET), and/or **Option C** (ESCO), but:

- **Kaggle:** run with **`--output=job-titles-skills-kaggle`** so it creates `job-titles-skills-kaggle.json` instead of overwriting the final file:
  ```bash
  node scripts/convert-kaggle-csv-to-json.js "PATH_TO_KAGGLE.csv" --output=job-titles-skills-kaggle
  ```
- **O*NET:** creates `job-titles-skills-onet.json` (no change).
- **ESCO:** creates `job-titles-skills-esco.json` (no change).

### Step 2: Merge all into one file

From `apps/web`:

```bash
node scripts/merge-job-datasets.js
```

This finds every `job-titles-skills-*.json` in `public/data/` (e.g. onet, esco, kaggle) and writes a single **`public/data/job-titles-skills.json`** with:
- No duplicate job titles (same title in two datasets = one entry).
- Skills merged (union of skills from all datasets for that title).

### Step 3: Refresh the app

Refresh the browser; the form will use the merged dataset for both pickers.

---

## Troubleshooting

### “File not found”
- Use the **full path** to the CSV/txt file (e.g. `/Users/...` or `C:\Users\...`).
- Put the path in **quotes** if it contains spaces.

### “Could not find title or skills column”
- Your CSV has different header names. Open the CSV and check the first row.
- Run with: `--title-col=YourTitleColumnName --skills-col=YourSkillsColumnName`.

### “No job titles” or “0 skills”
- For Kaggle: ensure the CSV has a title column and a skills column with data.
- For O*NET: ensure the occupation file has code + title, and Skills.txt has code + Element Name; default columns are 0 (code), 1 (title), 2 (skill name). Try `--title-col=1 --skill-name-col=2`.
- For ESCO: ensure the relation file links occupation IDs to skill IDs and that those IDs exist in the occupation and skill CSVs.

### App still shows the old/small list
- Confirm **`apps/web/public/data/job-titles-skills.json`** exists and is not empty.
- Do a **hard refresh** (Ctrl+Shift+R or Cmd+Shift+R) or restart `npm run dev`.
- In the browser, open DevTools → Network, reload the page, and check that a request to **`/data/job-titles-skills.json`** returns 200 and the JSON.

### Script says “Invalid JSON”
- You passed a file that isn’t in the expected format. For the **merge** script, only pass files that were produced by the **convert** scripts (or have the same `jobTitles` + `allSkills` structure).

---

## Quick reference – where things are

| What | Location |
|------|----------|
| Scripts | `apps/web/scripts/` |
| Output (what the app loads) | `apps/web/public/data/job-titles-skills.json` |
| Optional per-source files | `apps/web/public/data/job-titles-skills-onet.json`, `job-titles-skills-esco.json`, `job-titles-skills-kaggle.json` |
| Dataset docs | `apps/web/docs/DATA_DATASET.md` |

---

## Summary

1. **Easiest:** Download one Kaggle CSV → run `convert-kaggle-csv-to-json.js` with the file path → refresh app.
2. **Official US:** Download O*NET occupation + Skills.txt → run `convert-onet-to-json.js` → copy or merge to `job-titles-skills.json` → refresh app.
3. **European/large:** Download ESCO CSVs (occupations, skills, relation) → run `convert-esco-to-json.js` → copy or merge → refresh app.
4. **All sources:** Convert each to its own `job-titles-skills-*.json`, then run `merge-job-datasets.js` once → refresh app.

After any of these, the **Job Title** and **Required Skills** fields in “Post New Job” will use your dataset(s), and you can still type custom titles and skills.
