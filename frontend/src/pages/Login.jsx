import React from "react";

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI;
const COGNITO_ENABLED = Boolean(COGNITO_DOMAIN && CLIENT_ID && REDIRECT_URI);

// The checkout and order APIs sit behind a Cognito authorizer, so login always
// goes through the user pool's Hosted UI (no mock login in AWS mode).
export default function Login() {
  function redirectToCognito() {
    const url =
      `https://${COGNITO_DOMAIN}/login?response_type=token` +
      `&client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&scope=${encodeURIComponent("openid email profile")}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.href = url;
  }

  return (
    <div className="page page-narrow">
      <h1>Log in</h1>
      {COGNITO_ENABLED ? (
        <>
          <p className="muted">
            Authentication is handled by your Amazon Cognito user pool. New here? Use “Sign up” on the next
            page — Cognito emails you a verification code.
          </p>
          <button className="btn btn-primary" onClick={redirectToCognito}>
            Continue with Cognito
          </button>
        </>
      ) : (
        <p className="error">
          Cognito isn’t configured. Set VITE_COGNITO_DOMAIN, VITE_COGNITO_CLIENT_ID and
          VITE_COGNITO_REDIRECT_URI in frontend/.env (values come from the stack outputs).
        </p>
      )}
    </div>
  );
}
