#!/usr/bin/env node
/**
 * Converts a Kaggle (or any) CSV with job titles and skills into the JSON format
 * used by the RecruitAI job posting form.
 *
 * Usage:
 *   node scripts/convert-kaggle-csv-to-json.js <input.csv> [--title-col=column] [--skills-col=column] [--skills-sep=;]
 *
 * Default columns: "job_title" or "title" for title, "skills" or "required_skills" for skills.
 * If the CSV has a header, column names are auto-detected (case-insensitive).
 * Skills within a cell can be separated by comma, semicolon, or pipe (configurable via --skills-sep).
 *
 * Output: apps/web/public/data/job-titles-skills.json
 *
 * Example Kaggle datasets:
 * - https://www.kaggle.com/datasets/asaniczka/1-3m-linkedin-jobs-and-skills-2024
 * - https://www.kaggle.com/datasets/usmohamed/job-titles-and-roles-dataset-with-skills
 *
 * After downloading the CSV, run:
 *   node scripts/convert-kaggle-csv-to-json.js /path/to/linkedin_job_postings.csv --title-col=title --skills-col=skills
 */

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const inputPath = args.find((a) => !a.startsWith('--'))
const titleCol = args.find((a) => a.startsWith('--title-col='))?.split('=')[1]?.toLowerCase()
const skillsCol = args.find((a) => a.startsWith('--skills-col='))?.split('=')[1]?.toLowerCase()
const skillsSep = args.find((a) => a.startsWith('--skills-sep='))?.split('=')[1] || ','
const outputName = args.find((a) => a.startsWith('--output='))?.split('=')[1]?.trim() || 'job-titles-skills'

if (!inputPath) {
    console.error('Usage: node convert-kaggle-csv-to-json.js <input.csv> [--title-col=col] [--skills-col=col] [--skills-sep=;]')
    process.exit(1)
}

const csvPath = path.resolve(process.cwd(), inputPath)
if (!fs.existsSync(csvPath)) {
    console.error('File not found:', csvPath)
    process.exit(1)
}

function parseCSVLine(line) {
    const out = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
            inQuotes = !inQuotes
        } else if ((c === ',' && !inQuotes) || (c === '\t' && !inQuotes)) {
            out.push(cur.trim())
            cur = ''
        } else {
            cur += c
        }
    }
    out.push(cur.trim())
    return out
}

const content = fs.readFileSync(csvPath, 'utf-8')
const lines = content.split(/\r?\n/).filter((l) => l.trim())
if (lines.length === 0) {
    console.error('CSV is empty')
    process.exit(1)
}

const header = parseCSVLine(lines[0])
const headerLower = header.map((h) => h.toLowerCase().replace(/\s+/g, '_'))
const titleIdx = titleCol
    ? headerLower.indexOf(titleCol)
    : headerLower.findIndex((h) => ['job_title', 'title', 'job_title_name', 'position'].some((x) => h.includes(x)))
const skillsIdx = skillsCol
    ? headerLower.indexOf(skillsCol)
    : headerLower.findIndex((h) => ['skills', 'required_skills', 'skill_list', 'job_skills'].some((x) => h.includes(x)))

if (titleIdx === -1 || skillsIdx === -1) {
    console.error('Could not find title or skills column. Header:', header)
    console.error('Use --title-col=... and --skills-col=... to specify column names.')
    process.exit(1)
}

const jobTitles = {}
const allSkillsSet = new Set()
let rowCount = 0

for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i])
    const title = (cells[titleIdx] || '').trim()
    const rawSkills = (cells[skillsIdx] || '').trim()
    if (!title || !rawSkills) continue
    const skills = rawSkills
        .split(new RegExp(`[${skillsSep}|,]`))
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    if (skills.length === 0) continue
    const key = title
    if (!jobTitles[key]) jobTitles[key] = []
    const existing = new Set((jobTitles[key] || []).map((s) => s.toLowerCase()))
    skills.forEach((s) => {
        if (!existing.has(s.toLowerCase())) {
            jobTitles[key].push(s)
            existing.add(s.toLowerCase())
            allSkillsSet.add(s)
        }
    })
    rowCount++
}

const allSkills = Array.from(allSkillsSet).sort((a, b) => a.localeCompare(b))
const output = { jobTitles, allSkills }
const scriptDir = path.dirname(__filename)
const webRoot = path.resolve(scriptDir, '..')
const outDir = path.join(webRoot, 'public', 'data')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, outputName + (outputName.endsWith('.json') ? '' : '.json'))
fs.writeFileSync(outPath, JSON.stringify(output, null, 0), 'utf-8')
console.log(`Wrote ${Object.keys(jobTitles).length} job titles and ${allSkills.length} unique skills to ${outPath} (from ${rowCount} rows)`)
console.log('Restart or refresh the app to load the new dataset.')
