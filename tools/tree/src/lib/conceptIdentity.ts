import { Concept } from "../types/graph";
import { stableId } from "./seededRandom";

export function createConcept(title: string, summaryShort: string, createdAt: string): Concept {
  return {
    conceptId: stableId("concept", title.toLowerCase()),
    canonicalTitle: title,
    aliases: [],
    summaryShort,
    embeddingText: `${title}. ${summaryShort}`,
    createdAt,
    updatedAt: createdAt,
  };
}
