export type SchedulingProvider = 'none' | 'calcom' | 'google' | 'microsoft'

export type SchedulingAvailabilityRequest = {
    companyId: string
    participantEmails: string[]
    windowStartIso: string
    windowEndIso: string
}

export type SchedulingSlot = {
    startIso: string
    endIso: string
}

export interface SchedulingProviderClient {
    provider: SchedulingProvider
    getAvailability(_request: SchedulingAvailabilityRequest): Promise<SchedulingSlot[]>
    createMeetingLink(_title: string, _startIso: string, _endIso: string): Promise<string | null>
}

export class NoopSchedulingProviderClient implements SchedulingProviderClient {
    provider: SchedulingProvider = 'none'

    async getAvailability(): Promise<SchedulingSlot[]> {
        return []
    }

    async createMeetingLink(): Promise<string | null> {
        return null
    }
}

export function getSchedulingProviderClient(): SchedulingProviderClient {
    return new NoopSchedulingProviderClient()
}

