#!/usr/bin/env node
/**
 * Converts ESCO (European Commission) CSV files into the RecruitAI
 * job-titles-skills JSON format. 3,000+ occupations, 13,800+ skills.
 *
 * Download: https://esco.ec.europa.eu/en/use-esco/download
 * Select CSV format; get Occupations pillar, Skills pillar, and the
 * occupation–skill relationship file (often in "Relationships" or similar).
 *
 * Usage:
 *   node scripts/convert-esco-to-json.js --occupations=path/to/occupations.csv --skills=path/to/skills.csv --relation=path/to/occupation_skill_relation.csv
 *
 * Options (column names are case-insensitive, first row = header):
 *   --occupations=path     CSV: occupation id + label (default id col: "conceptUri" or "id", label: "preferredLabel")
 *   --skills=path          CSV: skill id + label
 *   --relation=path        CSV: occupation id + skill id (default cols: "occupationConceptUri" / "skillConceptUri" or "sourceConceptUri" / "targetConceptUri")
 *   --occ-id=col           Occupation ID column name in occupations and relation files
 *   --occ-label=col        Occupation label column in occupations file
 *   --skill-id=col         Skill ID column in skills and relation files
 *   --skill-label=col      Skill label column in skills file
 *
 * Output: apps/web/public/data/job-titles-skills-esco.json (use merge script to combine with others)
 */

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const getArg = (name, def) => {
    const a = args.find((x) => x.startsWith('--' + name + '='))
    return a ? a.split('=').slice(1).join('=').trim() : def
}

const occupationsPath = getArg('occupations', '')
const skillsPath = getArg('skills', '')
const relationPath = getArg('relation', '')
const occIdCol = (getArg('occ-id', 'concepturi') || 'id').toLowerCase().replace(/-/g, '')
const occLabelCol = (getArg('occ-label', 'preferredlabel') || 'preferredLabel').toLowerCase().replace(/-/g, '')
const skillIdCol = (getArg('skill-id', 'concepturi') || 'id').toLowerCase().replace(/-/g, '')
const skillLabelCol = (getArg('skill-label', 'preferredlabel') || 'preferredLabel').toLowerCase().replace(/-/g, '')

if (!occupationsPath || !skillsPath || !relationPath) {
    console.error('Usage: node convert-esco-to-json.js --occupations=path --skills=path --relation=path [--occ-id=col] [--occ-label=col] [--skill-id=col] [--skill-label=col]')
    process.exit(1)
}

const baseDir = process.cwd()
const paths = {
    occ: path.resolve(baseDir, occupationsPath),
    skill: path.resolve(baseDir, skillsPath),
    rel: path.resolve(baseDir, relationPath),
}
;[
    ['occ', 'Occupations file'],
    ['skill', 'Skills file'],
    ['rel', 'Relation file'],
].forEach(([k, label]) => {
    if (!fs.existsSync(paths[k])) {
        console.error(label + ' not found:', paths[k])
        process.exit(1)
    }
})

function parseCSVLine(line) {
    const out = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') inQuotes = !inQuotes
        else if (c === ',' && !inQuotes) {
            out.push(cur.trim())
            cur = ''
        } else cur += c
    }
    out.push(cur.trim())
    return out
}

function readCSV(filePath) {
    const text = fs.readFileSync(filePath, 'utf-8')
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return { header: [], rows: [] }
    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[-_\s]/g, ''))
    const rows = lines.slice(1).map((l) => parseCSVLine(l))
    return { header, rows }
}

function colIndex(header, possibleNames) {
    const norm = (s) => (s || '').toLowerCase().replace(/[-_\s]/g, '')
    const h = header.map(norm)
    for (const name of possibleNames) {
        const n = norm(name)
        const i = h.findIndex((c) => c === n || c.includes(n) || n.includes(c))
        if (i !== -1) return i
    }
    return 0
}

const occCSV = readCSV(paths.occ)
const occIdIx = colIndex(occCSV.header, [occIdCol, 'concepturi', 'id', 'occupationid'])
const occLabelIx = colIndex(occCSV.header, [occLabelCol, 'preferredlabel', 'title', 'label'])
const idToTitle = {}
occCSV.rows.forEach((row) => {
    const id = (row[occIdIx] || '').trim()
    const label = (row[occLabelIx] || '').trim().replace(/^"|"$/g, '')
    if (id && label) idToTitle[id] = label
})

const skillCSV = readCSV(paths.skill)
const skillIdIx = colIndex(skillCSV.header, [skillIdCol, 'concepturi', 'id', 'skillid'])
const skillLabelIx = colIndex(skillCSV.header, [skillLabelCol, 'preferredlabel', 'title', 'label'])
const idToSkill = {}
skillCSV.rows.forEach((row) => {
    const id = (row[skillIdIx] || '').trim()
    const label = (row[skillLabelIx] || '').trim().replace(/^"|"$/g, '')
    if (id && label) idToSkill[id] = label
})

const relCSV = readCSV(paths.rel)
const relOccIx = colIndex(relCSV.header, ['occupationconcepturi', 'sourceconcepturi', 'occupationid', 'concepturi'])
const relSkillIx = colIndex(relCSV.header, ['skillconcepturi', 'targetconcepturi', 'skillid'])
const occIdToSkillIds = {}
relCSV.rows.forEach((row) => {
    const occId = (row[relOccIx] || '').trim()
    const skillId = (row[relSkillIx] || '').trim()
    if (!occId || !skillId) return
    if (!occIdToSkillIds[occId]) occIdToSkillIds[occId] = []
    if (!occIdToSkillIds[occId].includes(skillId)) occIdToSkillIds[occId].push(skillId)
})

const jobTitles = {}
const allSkillsSet = new Set()
Object.keys(occIdToSkillIds).forEach((occId) => {
    const title = idToTitle[occId]
    if (!title) return
    const skillIds = occIdToSkillIds[occId]
    const skills = skillIds.map((sid) => idToSkill[sid]).filter(Boolean)
    if (skills.length === 0) return
    if (jobTitles[title]) {
        skills.forEach((s) => {
            if (!jobTitles[title].includes(s)) jobTitles[title].push(s)
            allSkillsSet.add(s)
        })
    } else {
        jobTitles[title] = [...skills]
        skills.forEach((s) => allSkillsSet.add(s))
    }
})

const allSkills = Array.from(allSkillsSet).sort((a, b) => a.localeCompare(b))
const output = { jobTitles, allSkills }
const scriptDir = path.dirname(__filename)
const webRoot = path.resolve(scriptDir, '..')
const outDir = path.join(webRoot, 'public', 'data')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'job-titles-skills-esco.json')
fs.writeFileSync(outPath, JSON.stringify(output, null, 0), 'utf-8')
console.log('ESCO: wrote', Object.keys(jobTitles).length, 'job titles and', allSkills.length, 'skills to', outPath)
