#!/usr/bin/env node
/**
 * Merges multiple job-titles-skills JSON files (our app format) into a single
 * file, deduplicating by job title (case-insensitive) and merging skills (union).
 * Use this after converting O*NET, ESCO, and/or Kaggle data to combine them
 * without duplicate titles.
 *
 * Usage:
 *   node scripts/merge-job-datasets.js [file1.json] [file2.json] ...
 *
 * If no files are given, merges all job-titles-skills-*.json in public/data/
 * (excluding the final job-titles-skills.json so we don't double-merge).
 *
 * Output: apps/web/public/data/job-titles-skills.json (this is what the app loads)
 */

const fs = require('fs')
const path = require('path')

const scriptDir = path.dirname(__filename)
const webRoot = path.resolve(scriptDir, '..')
const dataDir = path.join(webRoot, 'public', 'data')

const args = process.argv.slice(2)
let files = args.filter((a) => !a.startsWith('--'))
if (files.length === 0) {
    if (!fs.existsSync(dataDir)) {
        console.error('No files given and public/data does not exist. Run from apps/web or pass paths.')
        process.exit(1)
    }
    files = fs.readdirSync(dataDir)
        .filter((f) => f.startsWith('job-titles-skills-') && f.endsWith('.json') && f !== 'job-titles-skills.json')
        .map((f) => path.join(dataDir, f))
    if (files.length === 0) {
        console.error('No job-titles-skills-*.json files in public/data. Convert at least one dataset first.')
        process.exit(1)
    }
    console.log('Merging:', files.map((f) => path.basename(f)).join(', '))
} else {
    files = files.map((f) => path.resolve(process.cwd(), f))
    files.forEach((f) => {
        if (!fs.existsSync(f)) {
            console.error('File not found:', f)
            process.exit(1)
        }
    })
}

// Key by normalized title (lowercase) to avoid duplicates; value = { displayTitle, skills }
const byKey = {}
const allSkillsSet = new Set()

function normalizeTitle(t) {
    return (t || '').trim().toLowerCase()
}

files.forEach((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf-8')
    let data
    try {
        data = JSON.parse(raw)
    } catch (e) {
        console.error('Invalid JSON:', filePath, e.message)
        process.exit(1)
    }
    const titles = data.jobTitles || data
    const titlesObj = typeof titles === 'object' && !Array.isArray(titles) ? titles : {}
    Object.entries(titlesObj).forEach(([title, skills]) => {
        const key = normalizeTitle(title)
        if (!key) return
        const list = Array.isArray(skills) ? skills : []
        const normalized = list.map((s) => (s || '').trim()).filter(Boolean)
        if (normalized.length === 0) return
        if (!byKey[key]) {
            byKey[key] = { displayTitle: title.trim(), skills: [] }
        }
        const existingSet = new Set(byKey[key].skills.map((s) => s.toLowerCase()))
        normalized.forEach((s) => {
            if (!existingSet.has(s.toLowerCase())) {
                byKey[key].skills.push(s)
                existingSet.add(s.toLowerCase())
                allSkillsSet.add(s)
            }
        })
    })
    const fromFile = data.allSkills
    if (Array.isArray(fromFile)) fromFile.forEach((s) => allSkillsSet.add((s || '').trim()))
})

const jobTitles = {}
Object.values(byKey).forEach(({ displayTitle, skills }) => {
    jobTitles[displayTitle] = skills
})

const allSkills = Array.from(allSkillsSet).filter(Boolean).sort((a, b) => a.localeCompare(b))
const output = { jobTitles, allSkills }
fs.mkdirSync(dataDir, { recursive: true })
const outPath = path.join(dataDir, 'job-titles-skills.json')
fs.writeFileSync(outPath, JSON.stringify(output, null, 0), 'utf-8')
console.log('Merged', Object.keys(jobTitles).length, 'job titles and', allSkills.length, 'unique skills into', outPath)
console.log('Restart or refresh the app to load the new dataset.')
