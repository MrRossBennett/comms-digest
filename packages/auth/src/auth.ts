import "@tanstack/react-start/server-only";
// import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@repo/db";
import * as schema from "@repo/db/schema";
import { betterAuth } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins/magic-link";
import { tanstackStartCookies } from "better-auth/tanstack-start";

async function sendMagicLinkEmail({ email, url }: { email: string; url: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;

  if (!apiKey || !from) {
    const baseURL = process.env.VITE_BASE_URL;
    const isLocalDevelopment =
      baseURL?.startsWith("http://localhost:") || baseURL?.startsWith("http://127.0.0.1:");

    if (!isLocalDevelopment) {
      throw new Error("Magic link email is not configured.");
    }

    console.info(`[auth] Magic link for ${email}: ${url}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Sign in to Comms Digest",
      text: `Use this one-time link to sign in to Comms Digest:\n\n${url}\n\nThis link expires in 10 minutes. If you did not request it, you can ignore this email.`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send magic link email (${response.status}).`);
  }
}

export const auth = betterAuth({
  baseURL: process.env.VITE_BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  telemetry: {
    enabled: false,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  // https://better-auth.com/docs/integrations/tanstack#usage-tips
  plugins: [
    magicLink({
      expiresIn: 10 * 60,
      storeToken: "hashed",
      sendMagicLink: sendMagicLinkEmail,
    }),
    tanstackStartCookies(),
  ],

  // https://better-auth.com/docs/concepts/session-management#session-caching
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // https://better-auth.com/docs/concepts/oauth
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: "select_account",
    },
  },

  experimental: {
    // https://better-auth.com/docs/adapters/drizzle#joins-experimental
    joins: true,
  },
});
