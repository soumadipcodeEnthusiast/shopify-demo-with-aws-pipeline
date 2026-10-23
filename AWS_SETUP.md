# AWS setup — what's already code vs. what needs your own access

I cannot touch your AWS account from here (no credentials, and that's by
design — "less creds" means I never ask you for real AWS keys). Everything
below marked **[YOU DO THIS]** requires your own AWS account/credentials and
has to happen on your machine or in the AWS console. Everything else is
already written as code in `backend/aws/`.

## What's already built (code, not yet deployed)

- `template.yaml` — full AWS SAM template: DynamoDB tables (Products,
  Orders, OrderEvents), SQS queue + dead-letter queue with redrive policy,
  SNS topic, a Step Functions **Express** state machine, 11 Lambda
  functions, a Cognito User Pool + Hosted UI, and an API Gateway REST API
  wired to all of it.
- `statemachine/order-processing.asl.json` — the actual workflow definition
  (validate inventory → reserve inventory → mock payment → create order →
  publish to SNS, with compensation that releases reserved inventory if
  payment or order-creation fails).
- `src/*` — every Lambda's logic (checkout handler, SQS consumer that starts
  the workflow, the 5 workflow steps, the DLQ handler, the SNS→SES
  notification handler, the order-status API).
- `seed/seed-products.sh` — seeds the Products table after deploy.

None of this has been deployed or tested against a real AWS account — I
have no way to do that here. Validate with `sam validate` and `sam build`
before deploying.

## [YOU DO THIS] 1. One-time account setup

1. Create/sign in to an AWS account and configure credentials locally:
   `aws configure` (or `aws configure sso`). I never need to see these keys.
2. Install the AWS SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
3. Pick an AWS region (e.g. `us-east-1`) — use the same one in every command below.

## [YOU DO THIS] 2. Verify a sender identity in SES

The notification Lambda sends real email through Amazon SES. SES starts
every new account in **sandbox mode**, where you can only send to/from
addresses you've verified.

1. AWS Console → Simple Email Service → **Verified identities** → Create
   identity → verify an email address you control (e.g. your own inbox).
2. While still in the sandbox, also verify the recipient address you'll
   test checkout with (same screen) — sandbox mode requires both sides
   verified. (Request production access later if you want to email
   arbitrary customers.)
3. Keep that verified sender address — you'll pass it as
   `NotificationSenderEmail` in step 4.

If you skip this, the app still works end-to-end — the pipeline will mark
the `EMAIL_SENT` stage as **SKIPPED** with a clear warning instead of
pretending an email went out.

## [YOU DO THIS] 3. Pick a Cognito domain prefix

Cognito Hosted UI needs a domain prefix that's unique **across all of AWS**,
not just your account (e.g. `jane-shop-pipeline-2026`). You'll pass it as
`CognitoDomainPrefix` in step 4 — if `sam deploy` says it's taken, pick
another.

## [YOU DO THIS] 4. Build and deploy

```bash
cd backend/aws
npm install            # Lambda dependencies (AWS SDK v3 clients)
sam build
sam deploy --guided
```

When prompted, set:
- `NotificationSenderEmail` → the address you verified in step 2 (or leave blank to skip email)
- `CognitoCallbackUrl` → `http://localhost:5173/auth/callback` for local frontend testing
- `CognitoDomainPrefix` → the unique prefix from step 3

Save the outputs printed at the end (`ApiUrl`, `UserPoolId`,
`UserPoolClientId`, `CognitoDomain`, table names, queue/topic ARNs) — `sam
deploy --guided` also writes them to `samconfig.toml` for next time.

## [YOU DO THIS] 5. Seed the product catalog

```bash
cd backend/aws
./seed/seed-products.sh <ProductsTableName from the outputs> <your-region>
```

## [YOU DO THIS] 6. Point the frontend at your deployment

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:
```
VITE_API_BASE=<ApiUrl output>
VITE_COGNITO_DOMAIN=<CognitoDomain output>
VITE_COGNITO_CLIENT_ID=<UserPoolClientId output>
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/auth/callback
```

Then `npm install && npm run dev` and test the full journey against real AWS.

## [YOU DO THIS] 7. Create a Cognito user to log in with

Hosted UI's sign-up flow works out of the box — click "Continue with
Cognito" on the login page and use "Sign up" there, or create a user
directly: AWS Console → Cognito → your user pool → Users → Create user.

## Where to look to see it actually running

- **Order status / timeline**: the frontend polls `GET /orders/{id}`, which
  reads the `OrderEvents` DynamoDB table — every row there was written by a
  real Lambda as it ran.
- **Step Functions**: because this uses an **Express** workflow (chosen so
  the SQS consumer can wait synchronously for the result and retry on
  failure), executions do **not** show up in the Step Functions console's
  "Executions" tab the way Standard workflows do. Instead, check CloudWatch
  Logs → the log group created for `OrderProcessingStateMachine` — every
  state transition is logged there (`Logging: ALL` is already enabled in
  the template).
- **SQS retries/DLQ**: CloudWatch metrics on `OrderProcessingQueue` and
  `OrderProcessingDLQ`, or just watch `OrderEvents` for `SQS_DLQ` rows.
- **SES**: CloudWatch Logs for `NotificationHandlerFunction`, and your
  verified inbox.

## Known simplifications (flagging these rather than hiding them)

- **Cognito login uses the OAuth implicit grant** (token in the URL
  fragment) for simplicity in a demo SPA. Production apps should use
  Authorization Code + PKCE instead.
- **API CORS is wide open (`*`)** and SES IAM policy uses `Resource: "*"`
  for `ses:SendEmail` — fine for a demo, tighten both before using this
  anywhere real.
- **The Step Functions role lets it write to any log group** (needed for
  Express workflow log delivery, which AWS doesn't let you scope to one
  specific log group ARN pattern). Standard AWS limitation, not an oversight.

## Cleanup (avoid ongoing charges)

```bash
cd backend/aws
sam delete
```
This removes every resource the template created. DynamoDB/SQS/SNS/Lambda
usage here is tiny and mostly within the AWS free tier, but Cognito domains
and left-behind log groups can outlive the stack if you delete it some other
way — check the console after `sam delete` finishes.
