export const CURSOR_DATASETS = {
  members_usage: {
    key: "members_usage",
    label: "Members Usage cycle",
    description:
      "CSV do painel Cursor com uso por membro no ciclo (Name, Email, Role, Seat Type, Included/Free/On-Demand Usage).",
    expectedHeaders: [
      "Name",
      "Email",
      "Role",
      "Seat Type",
      "Included Usage",
      "Free Usage",
      "On-Demand Usage",
    ],
  },
  members_token_usage: {
    key: "members_token_usage",
    label: "Members Token Usage",
    description:
      "CSV de usage events do Cursor (Date, User, Kind, Model, tokens e Cost).",
    expectedHeaders: [
      "Date",
      "User",
      "Cloud Agent ID",
      "Automation ID",
      "Kind",
      "Model",
      "Max Mode",
      "Input (w/ Cache Write)",
      "Input (w/o Cache Write)",
      "Cache Read",
      "Output Tokens",
      "Total Tokens",
      "Cost",
    ],
  },
} as const;

export type CursorDatasetKey = keyof typeof CURSOR_DATASETS;

export const CURSOR_DATASET_LIST = Object.values(CURSOR_DATASETS);

export function isCursorDatasetKey(value: string): value is CursorDatasetKey {
  return value in CURSOR_DATASETS;
}
