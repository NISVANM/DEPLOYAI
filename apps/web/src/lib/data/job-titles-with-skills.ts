/**
 * Static job titles and skills used by the job posting form.
 * This is intentionally in-code (no external dataset loading) so that
 * the form always works without extra setup. You can expand this list
 * over time as needed.
 */
const TITLES_WITH_SKILLS: { title: string; skills: string[] }[] = [
    { title: 'Software Engineer', skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Git', 'REST APIs', 'SQL'] },
    { title: 'Senior Software Engineer', skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'System Design', 'Mentoring', 'Code Review'] },
    { title: 'Frontend Developer', skills: ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript', 'Responsive Design', 'Accessibility'] },
    { title: 'Senior Frontend Engineer', skills: ['React', 'TypeScript', 'Next.js', 'Performance', 'Testing', 'CI/CD'] },
    { title: 'Backend Developer', skills: ['Node.js', 'Python', 'SQL', 'REST APIs', 'Databases', 'Caching'] },
    { title: 'Full Stack Developer', skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'REST APIs', 'Docker'] },
    { title: 'DevOps Engineer', skills: ['Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Terraform', 'Linux', 'Monitoring'] },
    { title: 'Data Engineer', skills: ['Python', 'SQL', 'ETL', 'Spark', 'Data Warehousing', 'Airflow'] },
    { title: 'Data Scientist', skills: ['Python', 'R', 'Machine Learning', 'Statistics', 'SQL', 'Data Visualization'] },
    { title: 'Product Manager', skills: ['Product Strategy', 'Roadmapping', 'Stakeholder Management', 'Analytics', 'Agile'] },
    { title: 'Project Manager', skills: ['Project Planning', 'Agile', 'Scrum', 'JIRA', 'Stakeholder Management', 'Risk Management'] },
    { title: 'UX Designer', skills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems'] },
    { title: 'UI Designer', skills: ['Figma', 'Sketch', 'Adobe XD', 'Visual Design', 'Design Systems'] },
    { title: 'QA Engineer', skills: ['Manual Testing', 'Automated Testing', 'Selenium', 'Jest', 'Test Planning'] },
    { title: 'Mobile Developer (iOS)', skills: ['Swift', 'Xcode', 'iOS SDK', 'UIKit', 'SwiftUI'] },
    { title: 'Mobile Developer (Android)', skills: ['Kotlin', 'Java', 'Android SDK', 'Jetpack', 'Material Design'] },
    { title: 'Machine Learning Engineer', skills: ['Python', 'TensorFlow', 'PyTorch', 'MLOps', 'Statistics'] },
    { title: 'Security Engineer', skills: ['Security Audits', 'Penetration Testing', 'OWASP', 'Cryptography', 'Compliance'] },
    { title: 'Technical Writer', skills: ['Technical Writing', 'Documentation', 'API Docs', 'Markdown', 'Version Control'] },
    { title: 'HR Manager', skills: ['Recruitment', 'Employee Relations', 'HR Policies', 'Performance Management'] },
    { title: 'Marketing Manager', skills: ['Digital Marketing', 'SEO', 'Content Strategy', 'Analytics', 'Campaign Management'] },
    { title: 'Sales Representative', skills: ['Sales', 'CRM', 'Negotiation', 'Lead Generation', 'Customer Relationship'] },
    { title: 'Customer Success Manager', skills: ['Customer Success', 'Onboarding', 'Retention', 'CRM', 'Communication'] },
    { title: 'Business Analyst', skills: ['Requirements Gathering', 'Process Modeling', 'SQL', 'Stakeholder Analysis'] },
    { title: 'Content Writer', skills: ['Content Writing', 'SEO', 'Copywriting', 'Research', 'Editing'] },
]

export const JOB_TITLES_LIST = TITLES_WITH_SKILLS.map(({ title }) => title).sort((a, b) => a.localeCompare(b))

const titleToSkills = new Map<string, string[]>()
const allSkillsSet = new Set<string>()
TITLES_WITH_SKILLS.forEach(({ title, skills }) => {
    titleToSkills.set(title.toLowerCase(), skills)
    skills.forEach((s) => allSkillsSet.add(s))
})

export const ALL_SKILLS_LIST = Array.from(allSkillsSet).sort((a, b) => a.localeCompare(b))

/** Get suggested skills for a title (exact match, case-insensitive). */
export function getSkillsForJobTitle(title: string): string[] {
    if (!title || typeof title !== 'string') return []
    return titleToSkills.get(title.toLowerCase()) ?? []
}

