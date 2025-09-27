// lib/ajv.js
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { ExplainBatchSchema } from "../schemas/explainBatch.schema.js";

export const ajv = new Ajv({ allErrors: true, removeAdditional: true });
addFormats(ajv);
ajv.addSchema(ExplainBatchSchema, "ExplainBatch");
