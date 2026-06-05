/**
 * Communication Auto-Logger
 * Automatically logs communications from various sources
 */

import { logCommunication } from "@/lib/actions/communication-logs";

/**
 * Log an SMS message sent via Twilio
 */
export async function logSMSCommunication(input: {
  clientId: string;
  phoneNumber: string;
  messageText: string;
  twilioSid: string;
  fromAiEmployeeId?: string;
  campaignId?: string;
}) {
  try {
    await logCommunication({
      clientId: input.clientId,
      type: "sms",
      direction: "outbound",
      status: "sent",
      body: input.messageText,
      toPhoneNumber: input.phoneNumber,
      twilioMessageSid: input.twilioSid,
      fromAiEmployeeId: input.fromAiEmployeeId,
    });
  } catch (error) {
    console.error("[communication-auto-logger] SMS log error:", error);
    // Don't throw - logging failures shouldn't block business logic
  }
}

/**
 * Log an inbound SMS received via Twilio
 */
export async function logInboundSMSCommunication(input: {
  clientId: string;
  phoneNumber: string;
  messageText: string;
  twilioSid: string;
}) {
  try {
    await logCommunication({
      clientId: input.clientId,
      type: "sms",
      direction: "inbound",
      status: "delivered",
      body: input.messageText,
      fromPhoneNumber: input.phoneNumber,
      twilioMessageSid: input.twilioSid,
    });
  } catch (error) {
    console.error("[communication-auto-logger] inbound SMS log error:", error);
  }
}

/**
 * Log an email sent
 */
export async function logEmailCommunication(input: {
  clientId: string;
  email: string;
  subject: string;
  body?: string;
  messageId?: string;
  fromAiEmployeeId?: string;
}) {
  try {
    await logCommunication({
      clientId: input.clientId,
      type: "email",
      direction: "outbound",
      status: "sent",
      subject: input.subject,
      body: input.body,
      toEmail: input.email,
      emailMessageId: input.messageId,
      fromAiEmployeeId: input.fromAiEmployeeId,
    });
  } catch (error) {
    console.error("[communication-auto-logger] email log error:", error);
  }
}

/**
 * Log a phone call
 */
export async function logCallCommunication(input: {
  clientId: string;
  phoneNumber: string;
  durationSeconds: number;
  callSid: string;
  direction: "inbound" | "outbound";
  recordingUrl?: string;
  fromAiEmployeeId?: string;
  sentiment?: "positive" | "neutral" | "negative";
  summary?: string;
}) {
  try {
    await logCommunication({
      clientId: input.clientId,
      type: "call",
      direction: input.direction,
      status: "completed",
      durationSeconds: input.durationSeconds,
      [input.direction === "outbound" ? "toPhoneNumber" : "fromPhoneNumber"]:
        input.phoneNumber,
      twilioCallSid: input.callSid,
      fromAiEmployeeId: input.fromAiEmployeeId,
      sentiment: input.sentiment,
      aiSummary: input.summary,
    });
  } catch (error) {
    console.error("[communication-auto-logger] call log error:", error);
  }
}

/**
 * Log an appointment/event
 */
export async function logAppointmentCommunication(input: {
  clientId: string;
  appointmentId: string;
  title: string;
  description?: string;
}) {
  try {
    await logCommunication({
      clientId: input.clientId,
      type: "appointment",
      status: "completed",
      subject: input.title,
      body: input.description,
      appointmentId: input.appointmentId,
    });
  } catch (error) {
    console.error("[communication-auto-logger] appointment log error:", error);
  }
}

/**
 * Log a manual note
 */
export async function logNoteCommunication(input: {
  clientId: string;
  noteText: string;
  title?: string;
}) {
  try {
    await logCommunication({
      clientId: input.clientId,
      type: "note",
      subject: input.title || "Note",
      body: input.noteText,
    });
  } catch (error) {
    console.error("[communication-auto-logger] note log error:", error);
  }
}
