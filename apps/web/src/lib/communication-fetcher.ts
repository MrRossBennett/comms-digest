import { modelExtractionSchema } from "@repo/intelligence";
import { extractText } from "unpdf";
import { z } from "zod";

// A confirmed Communication Source, with its selected Students resolved.
// This is the input every CommunicationFetcher reasons about; each adapter
// handles only the sources whose `discovery` it recognises.
export type ConfirmedSource = {
  id: string;
  schoolId: string | null;
  senderName: string;
  senderDomain: string;
  audience: "household" | "school" | "children";
  discovery: "gmail" | "manual" | "sample";
  childIds: string[];
};

// One fetched message ready to be ingested into the Household's stored evidence.
// `recordedExtraction`, when present, bypasses the live model (sample/demo path).
export type IngestionCandidate = {
  source: ConfirmedSource;
  externalMessageId: string;
  receivedAt: string;
  subject: string;
  senderAddress: string;
  sourceText: string;
  recordedExtraction?: z.infer<typeof modelExtractionSchema>;
};

// The seam: a source of IngestionCandidates for a Household. Each adapter is
// handed the full confirmed-source list and returns candidates for the sources
// it owns. Two adapters justify the seam: Gmail in prod, recorded in tests/demo.
export type CommunicationFetcher = {
  fetch(sources: ConfirmedSource[]): Promise<IngestionCandidate[]>;
};

type SampleChild = { id: string; displayName: string };

// ─── Recorded adapter (sample sources) ──────────────────────────────────────
// Fabricates a first-Digest candidate per sample source, with a recorded
// extraction so the live model is never called. Used for the Demo Household
// and as the substitutable adapter in tests.
export function createRecordedFetcher(config: { children: SampleChild[] }): CommunicationFetcher {
  return {
    fetch: async (sources) =>
      sources
        .filter((source) => source.discovery === "sample")
        .map((source) => createSampleCandidate(source, config.children)),
  };
}

function createSampleCandidate(
  source: ConfirmedSource,
  householdChildren: SampleChild[],
): IngestionCandidate {
  const receivedAt = "2026-06-12T15:30:00.000Z";
  const externalMessageId = `sample:${source.id}:first-digest`;

  if (source.audience === "children" && source.childIds.length > 0) {
    const name =
      householdChildren.find(({ id }) => id === source.childIds[0])?.displayName ?? "Your student";
    const sourceText = `${name}'s museum visit is on Wednesday 24 June. Please return the signed permission form by Friday 19 June.`;
    const eventQuote = `${name}'s museum visit is on Wednesday 24 June.`;
    const responsibilityQuote = "Please return the signed permission form by Friday 19 June.";

    return {
      source,
      externalMessageId,
      receivedAt,
      subject: `${name}'s museum visit`,
      senderAddress: `office@${source.senderDomain}`,
      sourceText,
      recordedExtraction: modelExtractionSchema.parse({
        claims: [
          {
            content: `${name}'s museum visit is on 24 June 2026.`,
            audience: { scope: "child", originalWording: name },
            certainty: "confirmed",
            date: { originalWording: "Wednesday 24 June", resolvedDate: "2026-06-24" },
            citations: [citationFor(sourceText, eventQuote)],
          },
          {
            content: `The signed permission form is due by 19 June 2026.`,
            audience: { scope: "child", originalWording: name },
            certainty: "confirmed",
            date: { originalWording: "Friday 19 June", resolvedDate: "2026-06-19" },
            citations: [citationFor(sourceText, responsibilityQuote)],
          },
        ],
        responsibilities: [
          {
            title: `Return the signed museum visit permission form`,
            dueDate: { originalWording: "Friday 19 June", resolvedDate: "2026-06-19" },
            claimPositions: [1],
          },
        ],
      }),
    };
  }

  const sourceText =
    "Sports day is on Friday 26 June. Children should arrive wearing their house colours.";
  const eventQuote = "Sports day is on Friday 26 June.";
  const infoQuote = "Children should arrive wearing their house colours.";

  return {
    source,
    externalMessageId,
    receivedAt,
    subject: "Sports day",
    senderAddress: `office@${source.senderDomain}`,
    sourceText,
    recordedExtraction: modelExtractionSchema.parse({
      claims: [
        {
          content: "Sports day is on 26 June 2026.",
          audience: {
            scope: source.audience === "household" ? "household" : "school",
            originalWording: source.audience === "household" ? "all families" : "the whole school",
          },
          certainty: "confirmed",
          date: { originalWording: "Friday 26 June", resolvedDate: "2026-06-26" },
          citations: [citationFor(sourceText, eventQuote)],
        },
        {
          content: "Children should wear their house colours for sports day.",
          audience: {
            scope: source.audience === "household" ? "household" : "school",
            originalWording: "Children",
          },
          certainty: "confirmed",
          citations: [citationFor(sourceText, infoQuote)],
        },
      ],
      responsibilities: [],
    }),
  };
}

function citationFor(sourceText: string, quote: string) {
  const start = sourceText.indexOf(quote);
  return { quote, start, end: start + quote.length };
}

// ─── Gmail message payload → source text ─────────────────────────────────────
// A Gmail message payload in, the School Communication's source text out.
// Pure but for attachment download, which is injected so the reader can be
// exercised with fixture payloads (no Gmail round-trip).
export type GmailPart = {
  mimeType?: string;
  body?: { data?: string; attachmentId?: string };
  headers?: Array<{ name: string; value: string }>;
  parts?: GmailPart[];
};

export const gmailPartSchema: z.ZodType<GmailPart> = z.lazy(() =>
  z.object({
    mimeType: z.string().optional(),
    body: z.object({ data: z.string().optional(), attachmentId: z.string().optional() }).optional(),
    headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    parts: z.array(gmailPartSchema).optional(),
  }),
);

export type GmailAttachmentDownloader = (input: { attachmentId: string }) => Promise<string | null>;

export async function readGmailMessageContent(
  payload: GmailPart,
  deps: { downloadAttachment: GmailAttachmentDownloader },
): Promise<string | null> {
  const emailBodyText = extractGmailText(payload);
  const pdfParts = collectPdfParts(payload);
  const pdfSections: string[] = [];
  for (const pdfPart of pdfParts) {
    const data =
      pdfPart.body?.data ??
      (pdfPart.body?.attachmentId
        ? await deps.downloadAttachment({ attachmentId: pdfPart.body.attachmentId })
        : null);
    if (!data) continue;
    const filename = pdfPart.headers
      ?.find(({ name }) => name.toLowerCase() === "content-disposition")
      ?.value.match(/filename[^;=\n]*=\s*["']?([^"';\n]*)["']?/i)?.[1]
      ?.trim();
    const text = await extractPdfText(data);
    if (text) pdfSections.push(`--- Attachment: ${filename ?? "attachment.pdf"} ---\n\n${text}`);
  }

  return emailBodyText || pdfSections.length > 0
    ? [emailBodyText, ...pdfSections].filter(Boolean).join("\n\n")
    : null;
}

function extractGmailText(payload: GmailPart) {
  const plainParts: string[] = [];
  const visit = (part: GmailPart) => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      plainParts.push(decodeBase64Url(part.body.data));
    }
    part.parts?.forEach(visit);
  };
  visit(payload);

  const text = plainParts.join("\n\n").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  return text || null;
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8");
}

function collectPdfParts(payload: GmailPart) {
  const parts: GmailPart[] = [];
  const visit = (part: GmailPart) => {
    if (part.mimeType === "application/pdf" && (part.body?.data || part.body?.attachmentId)) {
      parts.push(part);
    }
    part.parts?.forEach(visit);
  };
  visit(payload);
  return parts;
}

async function extractPdfText(base64UrlData: string): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64UrlData.replaceAll("-", "+").replaceAll("_", "/"), "base64");
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    const cleaned = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
    return cleaned || null;
  } catch {
    return null;
  }
}
