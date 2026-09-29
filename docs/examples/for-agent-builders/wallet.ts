import { AXEClient } from "@summationai/axe-client";
import type { ConfirmRequest, Fulfiller, JsonValue } from "@summationai/axe-client";

// Stand-ins for your credential store and your UI. Nothing here is logged.
interface BankAccount {
  holderName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: "checking" | "savings";
}
interface Card {
  token: string;
  provider: string;
  brand: string;
  last4: string;
}
const vault = {
  async bankAccount(): Promise<BankAccount | undefined> {
    return {
      holderName: "Ana Ruiz",
      routingNumber: "021000021",
      accountNumber: "000123456789",
      accountType: "checking",
    };
  },
  async card(): Promise<Card | undefined> {
    return { token: "tok_1Q2w3E4r", provider: "stripe", brand: "visa", last4: "4242" };
  },
};
const profileStore = {
  email: "ana@example.com",
  address: {
    line1: "412 Pine St",
    line2: "Apt 9",
    city: "Seattle",
    region: "WA",
    postalCode: "98101",
    country: "US",
  },
};
async function askUser(question: string): Promise<boolean> {
  console.log(question);
  return true;
}

// #region wallet
/** Amount and currency named in the site's message, e.g. "A refundable $500 holding deposit". */
function amountIn(message: string): { amount: number; currency: string } | undefined {
  const m = /\$([0-9][0-9,]*(?:\.[0-9]{2})?)/.exec(message);
  return m?.[1] ? { amount: Number(m[1].replace(/,/g, "")), currency: "USD" } : undefined;
}

const wallet: Fulfiller = {
  kinds: ["payment.ach-debit", "payment.card"],
  async fulfill({ action, accept, message }) {
    if (accept.kind === "payment.ach-debit") {
      const bank = await vault.bankAccount();
      const money = amountIn(message);
      // ACH needs an explicit amount and authorization text. Without an amount, decline;
      // the client moves on to the next option or asks the user.
      if (!bank || !money) return undefined;
      return {
        accountHolderName: bank.holderName,
        routingNumber: bank.routingNumber,
        accountNumber: bank.accountNumber,
        accountType: bank.accountType,
        amount: money.amount,
        currency: money.currency,
        authorizedAt: new Date().toISOString(),
        authorizationText: `I authorize a one-time ACH debit of $${money.amount} ${money.currency} for ${action}.`,
      };
    }
    if (accept.kind === "payment.card") {
      const card = await vault.card();
      if (!card) return undefined;
      return { token: card.token, provider: card.provider, brand: card.brand, last4: card.last4 };
    }
    return undefined;
  },
};

const profile: Fulfiller = {
  kinds: ["contact.address", "contact.email"],
  fulfill({ accept }) {
    if (accept.kind === "contact.email") return { email: profileStore.email };
    if (accept.kind === "contact.address") return { ...profileStore.address };
    return undefined;
  },
};
// #endregion wallet

// #region confirm
/** A one-line summary for the user. Never includes a routing, account, or card number. */
function summarize({ action, accept, payload }: ConfirmRequest): string {
  const p = (payload ?? {}) as Record<string, JsonValue | undefined>;
  switch (accept.kind) {
    case "payment.ach-debit": {
      const last4 = typeof p.accountNumber === "string" ? p.accountNumber.slice(-4) : "????";
      return `Authorize a one-time bank debit of $${String(p.amount)} ${String(p.currency)} from your ${String(p.accountType)} account ending in ${last4} for "${action}".`;
    }
    case "payment.card":
      return `Charge your ${String(p.brand ?? "card")} ending in ${String(p.last4 ?? "????")} for "${action}".`;
    default:
      return `Send your ${accept.title.toLowerCase()} for "${action}".`;
  }
}

async function confirm(request: ConfirmRequest): Promise<boolean> {
  // The site's own words first, then exactly what will be sent, then the question.
  return askUser(`${request.message}\n${summarize(request)}\nGo ahead?`);
}
// #endregion confirm

// #region run
const client = await AXEClient.discover("https://oakridge-rentals.example", {
  agent: { name: "homefinder", version: "2.3.0", vendor: "Homefinder Labs" },
  // A function is re-read on every call, so a refreshed token is picked up.
  auth: () => process.env.OAKRIDGE_USER_TOKEN,
  fulfillers: [wallet, profile],
  // Without confirm, every sensitive option is skipped and the ladder falls through.
  confirm,
});

const outcome = await client.run("applications.submit", { unitId: "u_204" });
switch (outcome.status) {
  case "ok":
    console.log("Submitted:", outcome.result.output);
    break;
  case "needs_input":
    // Tried these kinds and none produced a payload (or the user declined a sensitive one).
    console.log(
      `Still needs one of ${outcome.result.accepts.map((a) => a.kind).join(", ")}; tried ${outcome.tried.join(", ")}`,
    );
    break;
  case "needs_human":
    console.log(outcome.handoff.whatAgentShouldSayToUser, outcome.handoff.url);
    break;
  case "pending":
    console.log(`Still processing; poll ${outcome.result.pollUrl}`);
    break;
  case "error":
    console.error(outcome.result.error.code, outcome.result.error.message);
    break;
}
// #endregion run
