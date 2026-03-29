import twilio from "twilio";

export function validateTwilioSignature(params: {
  authToken: string;
  signature: string;
  url: string;
  formParams: Record<string, string>;
}) {
  return twilio.validateRequest(
    params.authToken,
    params.signature,
    params.url,
    params.formParams
  );
}

export function buildTwimlReply(message: string) {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(message);
  return twiml.toString();
}
