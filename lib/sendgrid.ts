import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface SendViolationNoticeParams {
  to: string;
  ownerName: string;
  violationId: number;
  propertyAddress: string;
  description: string;
  categoryName?: string;
  fineAmount?: number;
  dueDate?: string;
  appealToken?: string;
}

export async function sendViolationNotice(
  params: SendViolationNoticeParams,
): Promise<void> {
  const {
    to,
    ownerName,
    violationId,
    propertyAddress,
    description,
    categoryName,
    fineAmount,
    dueDate,
    appealToken,
  } = params;

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const appealUrl = appealToken ? `${baseUrl}/appeals/${appealToken}` : null;

  const html = `
    <h1>Violation Notice #${violationId}</h1>
    <p>Dear ${ownerName},</p>
    <p>A violation has been recorded for your property at <strong>${propertyAddress}</strong>.</p>
    ${categoryName ? `<p><strong>Category:</strong> ${categoryName}</p>` : ""}
    <p><strong>Description:</strong> ${description}</p>
    ${fineAmount ? `<p><strong>Fine Amount:</strong> $${fineAmount}</p>` : ""}
    ${dueDate ? `<p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>` : ""}
    ${appealUrl ? `<p>To appeal this violation, please visit: <a href="${appealUrl}">${appealUrl}</a></p>` : ""}
    <p>If you have any questions, please contact us.</p>
  `;

  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL || "noreply@example.com",
    subject: `Violation Notice #${violationId} - ${propertyAddress}`,
    html,
  };

  await sgMail.send(msg);
}

export async function sendAppealConfirmation(params: {
  to: string;
  ownerName: string;
  violationId: number;
  appealId: number;
}): Promise<void> {
  const { to, ownerName, violationId, appealId } = params;

  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL || "noreply@example.com",
    subject: `Appeal Confirmation - Violation #${violationId}`,
    html: `
      <h1>Appeal Received</h1>
      <p>Dear ${ownerName},</p>
      <p>Your appeal (ID: ${appealId}) for violation #${violationId} has been received and is under review.</p>
      <p>We will notify you of the decision.</p>
    `,
  };

  await sgMail.send(msg);
}
