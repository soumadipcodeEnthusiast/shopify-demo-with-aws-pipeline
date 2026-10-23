const {
  SESClient,
  SendEmailCommand,
  GetIdentityVerificationAttributesCommand,
  VerifyEmailIdentityCommand,
} = require("@aws-sdk/client-ses");
const { putEvent } = require("../shared/ddb.js");

const ses = new SESClient({});

// SES sandbox only delivers to verified addresses. Returns the recipient's
// verification status, asking SES to send them a verification link if they
// have never been registered (e.g. users who signed up before the
// PostConfirmation trigger existed).
async function recipientStatus(email) {
  const { VerificationAttributes } = await ses.send(new GetIdentityVerificationAttributesCommand({ Identities: [email] }));
  const status = VerificationAttributes?.[email]?.VerificationStatus;
  if (!status) {
    await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: email }));
    return "Requested";
  }
  return status; // Success | Pending | Failed | TemporaryFailure
}

exports.handler = async (snsEvent) => {
  for (const record of snsEvent.Records) {
    const order = JSON.parse(record.Sns.Message);
    const { orderId, email, items = [], total = 0 } = order;

    await putEvent(orderId, { stage: "EMAIL_SENT", service: "SNS subscriber / Email", status: "RUNNING", message: "Notification handler invoked" });

    if (!process.env.SES_SENDER_EMAIL) {
      await putEvent(orderId, {
        stage: "EMAIL_SENT",
        service: "SNS subscriber / Email",
        status: "SKIPPED",
        message: "Email not sent — SES_SENDER_EMAIL is not configured. See AWS_SETUP.md to verify a sender identity in SES.",
      });
      continue;
    }

    const lines = items.map((i) => `  - ${i.name} x${i.qty} ($${(i.price * i.qty).toFixed(2)})`).join("\n");
    const body = `Order ${orderId} confirmed.\n\nItems:\n${lines}\n\nTotal: $${total.toFixed(2)}\nStatus: CONFIRMED`;

    try {
      const status = await recipientStatus(email);
      if (status !== "Success") {
        await putEvent(orderId, {
          stage: "EMAIL_SENT",
          service: "SNS subscriber / Email",
          status: "SKIPPED",
          message:
            status === "Requested"
              ? `Not sent — SES sandbox needs ${email} verified. AWS just emailed them a one-time verification link; after they click it, their order emails will arrive.`
              : `Not sent — ${email} hasn't clicked the AWS verification link yet (SES sandbox). Once they do, their order emails will arrive.`,
        });
        continue;
      }

      await ses.send(
        new SendEmailCommand({
          Source: process.env.SES_SENDER_EMAIL,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: `Order confirmation — ${orderId}` },
            Body: { Text: { Data: body } },
          },
        })
      );
      await putEvent(orderId, {
        stage: "EMAIL_SENT",
        service: "SNS subscriber / Email",
        status: "SUCCEEDED",
        message: `Confirmation email sent to ${email}`,
      });
    } catch (err) {
      // Never claim success on failure — e.g. SES sandbox mode requires the
      // recipient address to be verified too, or this will throw here.
      await putEvent(orderId, {
        stage: "EMAIL_SENT",
        service: "SNS subscriber / Email",
        status: "FAILED",
        message: `Email send failed: ${err.message}`,
      });
    }
  }
};
