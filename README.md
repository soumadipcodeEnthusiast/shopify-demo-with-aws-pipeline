# Shop Pipeline Demo

A minimal Shopify-styled storefront (login → products → cart → checkout) that
demonstrates a complete, honest order-processing pipeline: cart → checkout →
**SQS** job queue (with retries + dead-letter queue) → **Step Functions**
workflow (validate & reserve inventory, mock payment, persist order, with
compensation on failure) → **SNS** publish → email notification, with a live,
step-by-step "Live Order Pipeline" panel on the order page.

Two ways to run it:

| Mode | What it is | AWS account needed? |
|---|---|---|
| **Local demo** (`backend/local-server`) | Node/Express server that simulates every stage with the same event shape the frontend expects. Clearly labeled as simulated. | No |
| **AWS mode** (`backend/aws`) | Real API Gateway, Lambda, DynamoDB, SQS, SNS, Step Functions (Express), Cognito, SES, deployed with AWS SAM. | Yes — see [AWS_SETUP.md](./AWS_SETUP.md) |

The frontend is identical in both modes — it just points `VITE_API_BASE` at
either `localhost:4000` or your deployed API Gateway URL.

## Run the local demo (no AWS account required)

```bash
# Terminal 1 — backend
cd backend/local-server
npm install
npm start          # http://localhost:4000

# Terminal 2 — frontend
cd frontend
npm install
cp .env.example .env   # defaults already point at localhost:4000
npm run dev         # http://localhost:5173
```

Open http://localhost:5173, log in with any email (demo login, no real
auth), add products to the cart, and check out. Watch the **Live Order
Pipeline** panel on the resulting order page update stage by stage.

The checkout form has a **"Failure demonstration"** dropdown — pick
"insufficient inventory" or "payment failure" to see the SQS retry → DLQ
path and (for payment failure) the inventory-release compensation step.

Email sending is off by default (events are logged, not faked as sent). To
send real confirmation emails locally, fill in `backend/local-server/.env`
with SMTP credentials (see `.env.example`).

## Run against real AWS

See **[AWS_SETUP.md](./AWS_SETUP.md)** — it lists exactly which steps need
your own AWS account access, and which ones I already wrote as code.

## Project layout

```
frontend/              React (Vite) SPA — Shopify-styled products/cart/checkout/login/order-status pages
backend/local-server/  Express server simulating the pipeline — run this for the no-AWS demo
backend/aws/           AWS SAM template + Lambda source + Step Functions definition — deploy this for the real thing
```
