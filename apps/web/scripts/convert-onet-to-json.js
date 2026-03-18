#!/usr/bin/env node
/**
 * Converts O*NET (U.S. Department of Labor) tab-delimited files into the
 * RecruitAI job-titles-skills JSON format. Use this for the most comprehensive
 * occupational data (900+ occupations, KSAs).
 *
 * Download: https://onetcenter.org/database.html
 * Get: "Occupation Data" (or Alternate Titles) + "Skills" in tab-delimited text.
 *
 * Usage:
 *   node scripts/convert-onet-to-json.js --occupation-file=path/to/Occupation.txt --skills-file=path/to/Skills.txt
 *
 * Options:
 *   --occupation-file=path   Tab-delimited: col0 = O*NET-SOC Code, col1 = Title (or use --title-col=1)
 *   --skills-file=path       Tab-delimited: col0 = O*NET-SOC Code, col2 = Element Name (skill)
 *   --title-col=0            Column index in occupation file for title (default: 1)
 *   --code-col=0             Column index for O*NET-SOC code in both files (default: 0)
 *   --skill-name-col=2       Column index in skills file for skill name (default: 2)
 *
 * Output: apps/web/public/data/job-titles-skills-onet.json (use merge script to combine with others)
 */

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const getArg = (name, def) => {
    const a = args.find((x) => x.startsWith('--' + name + '='))
    return a ? a.split('=')[1] : def
}
const getArgNum = (name, def) => {
    const v = getArg(name, String(def))
    const n = parseInt(v, 10)
    return isNaN(n) ? def : n
}

const occupationPath = getArg('occupation-file', '')
const skillsPath = getArg('skills-file', '')
const titleCol = getArgNum('title-col', 1)
const codeCol = getArgNum('code-col', 0)
const skillNameCol = getArgNum('skill-name-col', 2)

if (!occupationPath || !skillsPath) {
    console.error('Usage: node convert-onet-to-json.js --occupation-file=path --skills-file=path [--title-col=1] [--code-col=0] [--skill-name-col=2]')
    process.exit(1)
}

const baseDir = process.cwd()
const occPath = path.resolve(baseDir, occupationPath)
const skPath = path.resolve(baseDir, skillsPath)
;['Occupation file', 'Skills file'].forEach((label, i) => {
    const p = i === 0 ? occPath : skPath
    if (!fs.existsSync(p)) {
        console.error(label + ' not found:', p)
        process.exit(1)
    }
})

function parseTabLine(line) {
    return line.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''))
}

// One code -> multiple titles (e.g. main + alternate), all get the same skills
const codeToTitles = {}
const occContent = fs.readFileSync(occPath, 'utf-8')
const occLines = occContent.split(/\r?\n/).filter((l) => l.trim())
for (let i = 1; i < occLines.length; i++) {
    const cells = parseTabLine(occLines[i])
    const code = (cells[codeCol] || '').trim()
    const title = (cells[titleCol] || '').trim()
    if (!code || !title) continue
    if (!codeToTitles[code]) codeToTitles[code] = []
    if (!codeToTitles[code].includes(title)) codeToTitles[code].push(title)
}

const codeToSkills = {}
const skContent = fs.readFileSync(skPath, 'utf-8')
const skLines = skContent.split(/\r?\n/).filter((l) => l.trim())
for (let i = 1; i < skLines.length; i++) {
    const cells = parseTabLine(skLines[i])
    const code = (cells[codeCol] || '').trim()
    const skill = (cells[skillNameCol] || '').trim()
    if (!code || !skill) continue
    if (!codeToSkills[code]) codeToSkills[code] = []
    if (!codeToSkills[code].includes(skill)) codeToSkills[code].push(skill)
}

const jobTitles = {}
const allSkillsSet = new Set()
Object.keys(codeToTitles).forEach((code) => {
    const titles = codeToTitles[code]
    const skills = codeToSkills[code] || []
    if (skills.length === 0) return
    titles.forEach((title) => {
        const existing = jobTitles[title]
        if (existing) {
            skills.forEach((s) => {
                if (!existing.includes(s)) existing.push(s)
                allSkillsSet.add(s)
            })
        } else {
            jobTitles[title] = [...skills]
            skills.forEach((s) => allSkillsSet.add(s))
        }
    })
})

const allSkills = Array.from(allSkillsSet).sort((a, b) => a.localeCompare(b))
const output = { jobTitles, allSkills }
const scriptDir = path.dirname(__filename)
const webRoot = path.resolve(scriptDir, '..')
const outDir = path.join(webRoot, 'public', 'data')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'job-titles-skills-onet.json')
fs.writeFileSync(outPath, JSON.stringify(output, null, 0), 'utf-8')
console.log('O*NET: wrote', Object.keys(jobTitles).length, 'job titles and', allSkills.length, 'skills to', outPath)
