const { SESClient, VerifyEmailIdentityCommand } = require("@aws-sdk/client-ses");

const ses = new SESClient({});

// Cognito PostConfirmation trigger. SES sandbox only delivers to verified
// addresses, so as soon as a user confirms their sign-up we ask SES to send
// them a one-time verification link. Once they click it, order confirmation
// emails go straight to their own inbox.
exports.handler = async (event) => {
  const email = event.request?.userAttributes?.email;
  if (event.triggerSource === "PostConfirmation_ConfirmSignUp" && email) {
    try {
      await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: email }));
    } catch (err) {
      // Never block sign-up over this; the notification handler retries later.
      console.error(`Could not request SES verification for ${email}:`, err);
    }
  }
  return event;
};
