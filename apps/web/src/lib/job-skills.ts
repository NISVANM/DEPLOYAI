const REQUIRED_SKILL_PREFIX = '[REQ]'

export function encodeJobSkills(skills: string[], requiredSkills: string[]): string[] {
    const requiredSet = new Set(requiredSkills)
    return skills.map((skill) => (requiredSet.has(skill) ? `${REQUIRED_SKILL_PREFIX}${skill}` : skill))
}

export function stripRequiredSkillMarker(skill: string): string {
    return skill.startsWith(REQUIRED_SKILL_PREFIX) ? skill.slice(REQUIRED_SKILL_PREFIX.length) : skill
}

export function decodeJobSkills(rawSkills: string[] | null | undefined): {
    allSkills: string[]
    requiredSkills: string[]
    optionalSkills: string[]
} {
    const input = Array.isArray(rawSkills) ? rawSkills : []
    const allSkills = input.map(stripRequiredSkillMarker).filter(Boolean)
    const requiredSkills = input
        .filter((skill) => skill.startsWith(REQUIRED_SKILL_PREFIX))
        .map(stripRequiredSkillMarker)
        .filter(Boolean)
    const requiredSet = new Set(requiredSkills)
    const optionalSkills = allSkills.filter((skill) => !requiredSet.has(skill))
    return { allSkills, requiredSkills, optionalSkills }
}

export function findMissingRequiredSkills(requiredSkills: string[], candidateSkills: string[] | null | undefined): string[] {
    const candidateList = Array.isArray(candidateSkills) ? candidateSkills : []
    const exactSet = new Set(candidateList)
    const normalizedSet = new Set(candidateList.map((skill) => skill.trim().toLowerCase()))
    return requiredSkills.filter((required) => {
        if (exactSet.has(required)) return false
        return !normalizedSet.has(required.trim().toLowerCase())
    })
}
