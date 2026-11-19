/** Names the app uses for itself, in one place. */
export const VOCAB = {
  advisor: "Pathways Advisor",
  app: "Academic Pathways Advisor",
} as const;

/** The app's slug under `metadata.apps.<slug>` in the org's metadata object. */
export const APP_SLUG = "advisor";

export const STATUS_LABEL = {
  draft: "Draft",
  submitted: "Awaiting advisor",
  approved: "Approved",
  changes_requested: "Changes requested",
} as const;
