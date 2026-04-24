export {
  MrScraperError,
  fetchHtml,
  createAiScraper,
  rerunAiScraper,
  bulkRerunAiScraper,
  rerunManualScraper,
  bulkRerunManualScraper,
  getAllResults,
  getResultById,
  googleSerpSync,
} from "./api.js";

export type {
  ScraperAgent,
  SortField,
  SortOrder,
  FetchHtmlOptions,
  CreateAiScraperOptions,
  RerunAiScraperOptions,
  BulkRerunAiScraperOptions,
  RerunManualScraperOptions,
  BulkRerunManualScraperOptions,
  GetAllResultsOptions,
  GetResultByIdOptions,
  GoogleSerpSyncOptions,
} from "./api.js";
