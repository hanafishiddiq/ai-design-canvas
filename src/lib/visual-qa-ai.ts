import { AI_EDIT_SCHEMA, type AiEditProposal, validateAiEditProposal } from "./ai-edit";

export interface VisualQaIssue {
  severity:"info"|"warning"|"error";
  category:"layout"|"typography"|"color"|"content"|"component"|"responsive"|"accessibility";
  description:string;
  suggestedChange:string;
  nodeId:string|null;
}
export interface VisualQaAiResult { summary:string; issues:VisualQaIssue[]; proposal:AiEditProposal }

export const VISUAL_QA_AI_SCHEMA={
  type:"object",additionalProperties:false,
  properties:{
    summary:{type:"string"},
    issues:{type:"array",maxItems:24,items:{type:"object",additionalProperties:false,properties:{
      severity:{type:"string",enum:["info","warning","error"]},
      category:{type:"string",enum:["layout","typography","color","content","component","responsive","accessibility"]},
      description:{type:"string"},suggestedChange:{type:"string"},nodeId:{type:["string","null"]},
    },required:["severity","category","description","suggestedChange","nodeId"]}},
    proposal:AI_EDIT_SCHEMA,
  },required:["summary","issues","proposal"],
} as const;

export function validateVisualQaAiResult(value:unknown):value is VisualQaAiResult{
  if(!value||typeof value!=="object")return false;
  const candidate=value as Partial<VisualQaAiResult>;
  return typeof candidate.summary==="string"&&Array.isArray(candidate.issues)&&validateAiEditProposal(candidate.proposal);
}
