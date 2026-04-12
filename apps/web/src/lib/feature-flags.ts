function readBool(value: string | undefined): boolean {
    if (!value) return false
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function isHrisWebhooksEnabled(): boolean {
    return readBool(process.env.FEATURE_HRIS_WEBHOOKS)
}

export function isCandidateEmailAutomationEnabled(): boolean {
    return readBool(process.env.FEATURE_CANDIDATE_EMAIL_AUTOMATION)
}

/** When unset, scheduling UI (Cal.com) is on; set FEATURE_SCHEDULING=false to hide it. */
export function isSchedulingEnabled(): boolean {
    const v = process.env.FEATURE_SCHEDULING
    if (v === undefined || v === '') return true
    return readBool(v)
}

