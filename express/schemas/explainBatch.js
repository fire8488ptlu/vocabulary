// schemas/explainBatch.schema.js
export const ExplainItem = {
  type: "object",
  additionalProperties: false,
  required: ["v_id", "v_title", "explain"],
  properties: {
    v_id: { type: "integer", minimum: 1 },
    v_title: { type: "string", minLength: 1, maxLength: 255 },
    explain: { type: "string", minLength: 3 },
  },
};

export const ExplainBatchSchema = {
  $id: "ExplainBatch",
  type: "array",
  minItems: 1,
  items: ExplainItem,
};
