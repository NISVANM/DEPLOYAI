export const CANDIDATE_STATUSES = [
    'new',
    'screening',
    'interviewed',
    'offered',
    'hired',
    'rejected',
] as const

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]

export type CandidateStatusChangedEvent = {
    companyId: string
    candidateId: string
    candidateName: string
    candidateEmail: string
    candidatePhone?: string | null
    candidateScore?: number | null
    jobId: string
    jobTitle: string
    fromStatus: CandidateStatus
    toStatus: CandidateStatus
    changedByUserId: string
    changedAt: Date
}

