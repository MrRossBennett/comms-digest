import { v5 as uuidv5 } from "uuid";
import { z } from "zod";

import {
  modelExtractionSchema,
  schoolCommunicationSchema,
  type ModelExtraction,
  type SchoolCommunication,
} from "./contracts";
import { createExtractionWorkflow } from "./workflow";

const corpusEntrySchema = z
  .object({
    communication: schoolCommunicationSchema,
    recordedExtraction: modelExtractionSchema,
  })
  .strict();

const stableIdNamespace = "018f1f5e-7b5a-7cc0-9d26-7f4f6fc97cff";

function stableIdGenerator(communicationId: string) {
  let position = 0;
  return () => uuidv5(`${communicationId}:${position++}`, stableIdNamespace);
}

export async function extractCorpus(
  corpusInput: unknown,
  extract: (communication: SchoolCommunication) => Promise<ModelExtraction>,
) {
  const corpus = z.array(corpusEntrySchema).min(1).parse(corpusInput);

  return Promise.all(
    corpus.map(async ({ communication }) => {
      const workflow = createExtractionWorkflow({
        extract,
        createId: stableIdGenerator(communication.id),
      });
      const result = await workflow.invoke({ communication });
      if (!result.validated) {
        throw new Error(`Extraction workflow completed without output for ${communication.id}`);
      }
      return result.validated;
    }),
  );
}

export function createRecordedCorpusExtractor(corpusInput: unknown) {
  const corpus = z.array(corpusEntrySchema).min(1).parse(corpusInput);
  const extractions = new Map(
    corpus.map(({ communication, recordedExtraction }) => [communication.id, recordedExtraction]),
  );

  return async (communication: SchoolCommunication) => {
    const extraction = extractions.get(communication.id);
    if (!extraction) {
      throw new Error(`No recorded extraction for School Communication ${communication.id}`);
    }
    return extraction;
  };
}
