import { modelExtractionSchema, schoolCommunicationSchema } from "./contracts";
import communicationData from "./fixture-data/year-4-swimming.communication.json";
import expectedData from "./fixture-data/year-4-swimming.expected.json";

export const year4SwimmingFixture = {
  communication: schoolCommunicationSchema.parse(communicationData),
  expected: modelExtractionSchema.parse(expectedData),
};
