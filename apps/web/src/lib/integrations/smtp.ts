import nodemailer from 'nodemailer'

export type SmtpConfig = {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
    fromEmail: string
    fromName?: string
}

export async function sendSmtpMail(config: SmtpConfig, to: string, subject: string, html: string): Promise<string> {
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass,
        },
    })

    const from = config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail
    const result = await transporter.sendMail({
        from,
        to,
        subject,
        html,
    })

    return result.messageId
}

