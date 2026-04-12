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

function htmlToPlainText(html: string): string {
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 16_000)
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
        replyTo: config.fromEmail,
        subject,
        text: htmlToPlainText(html) || subject,
        html,
    })

    // SMTP "sent" = mail server accepted the message; inbox delivery is separate (spam filters, recipient server).
    const maskTo = to.includes('@') ? `${to.split('@')[0]!.slice(0, 2)}***@${to.split('@')[1]}` : '***'
    console.info('[smtp] accepted', {
        messageId: result.messageId,
        to: maskTo,
        response: typeof result.response === 'string' ? result.response.slice(0, 200) : result.response,
    })

    return result.messageId
}

