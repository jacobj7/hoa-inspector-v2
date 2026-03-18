import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 40,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#444444",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    textDecoration: "underline",
  },
  text: {
    fontSize: 11,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  bold: {
    fontWeight: "bold",
  },
  violationBox: {
    backgroundColor: "#f5f5f5",
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#cc0000",
  },
  appealSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#e8f4fd",
    borderWidth: 1,
    borderColor: "#2196f3",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 9,
    color: "#666666",
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    paddingTop: 10,
  },
});

function ViolationNoticeDocument({
  violation,
  appealUrl,
  noticeDate,
}: {
  violation: any;
  appealUrl: string;
  noticeDate: string;
}) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, "VIOLATION NOTICE"),
        React.createElement(
          Text,
          { style: styles.subtitle },
          `Notice Date: ${noticeDate}`,
        ),
        React.createElement(
          Text,
          { style: styles.subtitle },
          `Notice ID: ${violation.id}`,
        ),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(
          Text,
          { style: styles.sectionTitle },
          "RECIPIENT INFORMATION",
        ),
        React.createElement(
          Text,
          { style: styles.text },
          `Name: ${violation.recipient_name || "N/A"}`,
        ),
        React.createElement(
          Text,
          { style: styles.text },
          `Address: ${violation.address || "N/A"}`,
        ),
        React.createElement(
          Text,
          { style: styles.text },
          `Email: ${violation.email || "N/A"}`,
        ),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(
          Text,
          { style: styles.sectionTitle },
          "VIOLATION DETAILS",
        ),
        React.createElement(
          View,
          { style: styles.violationBox },
          React.createElement(
            Text,
            { style: styles.text },
            `Violation Type: ${violation.type || "N/A"}`,
          ),
          React.createElement(
            Text,
            { style: styles.text },
            `Description: ${violation.description || "N/A"}`,
          ),
          React.createElement(
            Text,
            { style: styles.text },
            `Date of Violation: ${violation.violation_date || "N/A"}`,
          ),
          React.createElement(
            Text,
            { style: styles.text },
            `Location: ${violation.location || "N/A"}`,
          ),
          React.createElement(
            Text,
            { style: styles.text },
            `Fine Amount: ${violation.fine_amount ? `$${violation.fine_amount}` : "N/A"}`,
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(
          Text,
          { style: styles.sectionTitle },
          "REQUIRED ACTION",
        ),
        React.createElement(
          Text,
          { style: styles.text },
          "You are hereby notified of the above violation. You must take one of the following actions within 30 days of this notice:",
        ),
        React.createElement(
          Text,
          { style: styles.text },
          "1. Pay the fine amount indicated above",
        ),
        React.createElement(
          Text,
          { style: styles.text },
          "2. Submit an appeal using the link provided below",
        ),
        React.createElement(
          Text,
          { style: styles.text },
          "3. Contact our office to discuss payment arrangements",
        ),
      ),
      React.createElement(
        View,
        { style: styles.appealSection },
        React.createElement(
          Text,
          { style: styles.sectionTitle },
          "APPEAL INFORMATION",
        ),
        React.createElement(
          Text,
          { style: styles.text },
          "If you believe this violation was issued in error, you have the right to appeal. To submit your appeal, visit the following URL:",
        ),
        React.createElement(
          Text,
          { style: [styles.text, styles.bold] },
          appealUrl,
        ),
        React.createElement(
          Text,
          { style: styles.text },
          "This appeal link is unique to your notice and will expire in 30 days.",
        ),
      ),
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          null,
          "This is an official notice. Please retain for your records. For questions, contact our office.",
        ),
      ),
    ),
  );
}

async function sendEmailViaSendGrid({
  to,
  subject,
  htmlContent,
  pdfBuffer,
  pdfFilename,
}: {
  to: string;
  subject: string;
  htmlContent: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@example.com";

  const payload = {
    personalizations: [
      {
        to: [{ email: to }],
        subject,
      },
    ],
    from: { email: fromEmail },
    content: [
      {
        type: "text/html",
        value: htmlContent,
      },
    ],
    attachments: [
      {
        content: pdfBuffer.toString("base64"),
        filename: pdfFilename,
        type: "application/pdf",
        disposition: "attachment",
      },
    ],
  };

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `SendGrid API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Invalid violation ID" },
        { status: 400 },
      );
    }

    const { id } = parsedParams.data;

    const violationResult = await db.query(
      `SELECT v.*, 
              u.name as recipient_name, 
              u.email as email
       FROM violations v
       LEFT JOIN users u ON v.user_id = u.id
       WHERE v.id = $1`,
      [id],
    );

    if (violationResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Violation not found" },
        { status: 404 },
      );
    }

    const violation = violationResult.rows[0];

    const appealToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 30);

    await db.query(
      `INSERT INTO appeal_tokens (violation_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (violation_id) DO UPDATE 
       SET token = $2, expires_at = $3, created_at = NOW()`,
      [id, appealToken, tokenExpiry.toISOString()],
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const appealUrl = `${baseUrl}/appeal?token=${appealToken}&violation=${id}`;

    const noticeDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const pdfBuffer = await renderToBuffer(
      React.createElement(ViolationNoticeDocument, {
        violation,
        appealUrl,
        noticeDate,
      }),
    );

    const pdfFilename = `violation-notice-${id}-${Date.now()}.pdf`;

    const blob = await put(pdfFilename, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
    });

    const pdfUrl = blob.url;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Violation Notice</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #cc0000; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .violation-box { background-color: #fff3f3; border-left: 4px solid #cc0000; padding: 15px; margin: 15px 0; }
            .appeal-box { background-color: #e8f4fd; border: 1px solid #2196f3; padding: 15px; margin: 15px 0; }
            .button { display: inline-block; background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>VIOLATION NOTICE</h1>
            <p>Notice Date: ${noticeDate}</p>
          </div>
          <div class="content">
            <p>Dear ${violation.recipient_name || "Recipient"},</p>
            <p>You have received a violation notice. Please review the details below:</p>
            
            <div class="violation-box">
              <h3>Violation Details</h3>
              <p><strong>Violation ID:</strong> ${violation.id}</p>
              <p><strong>Type:</strong> ${violation.type || "N/A"}</p>
              <p><strong>Description:</strong> ${violation.description || "N/A"}</p>
              <p><strong>Date:</strong> ${violation.violation_date || "N/A"}</p>
              <p><strong>Location:</strong> ${violation.location || "N/A"}</p>
              <p><strong>Fine Amount:</strong> ${violation.fine_amount ? `$${violation.fine_amount}` : "N/A"}</p>
            </div>
            
            <p>Please find the official notice attached as a PDF document.</p>
            
            <div class="appeal-box">
              <h3>Appeal This Violation</h3>
              <p>If you believe this violation was issued in error, you can submit an appeal within 30 days:</p>
              <a href="${appealUrl}" class="button">Submit Appeal</a>
              <p style="font-size: 12px; color: #666;">Or copy this link: ${appealUrl}</p>
            </div>
            
            <p>You can also view your notice online: <a href="${pdfUrl}">View PDF Notice</a></p>
          </div>
          <div class="footer">
            <p>This is an official notice. Please retain for your records.</p>
          </div>
        </body>
      </html>
    `;

    if (violation.email) {
      await sendEmailViaSendGrid({
        to: violation.email,
        subject: `Violation Notice - ${violation.id}`,
        htmlContent: emailHtml,
        pdfBuffer: Buffer.from(pdfBuffer),
        pdfFilename,
      });
    }

    const noticeResult = await db.query(
      `INSERT INTO violation_notices 
         (violation_id, pdf_url, appeal_token, appeal_url, sent_at, sent_to_email, created_by, created_at)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW())
       RETURNING id, violation_id, pdf_url, appeal_url, sent_at, sent_to_email`,
      [
        id,
        pdfUrl,
        appealToken,
        appealUrl,
        violation.email || null,
        session.user.id || session.user.email,
      ],
    );

    await db.query(
      `UPDATE violations SET status = 'notice_sent', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    const notice = noticeResult.rows[0];

    return NextResponse.json(
      {
        success: true,
        notice: {
          id: notice.id,
          violationId: notice.violation_id,
          pdfUrl: notice.pdf_url,
          appealUrl: notice.appeal_url,
          sentAt: notice.sent_at,
          sentToEmail: notice.sent_to_email,
        },
        message: violation.email
          ? "Notice generated and email sent successfully"
          : "Notice generated successfully (no email on file)",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error generating violation notice:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate violation notice",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
