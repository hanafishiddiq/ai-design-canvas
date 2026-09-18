import { mergeTokens, parseDesignMd, serializeDesignMd } from "./design-md";
import { generateTokens } from "./foundations";
import type { DesignDirection, DesignProject, DesignTokens, FoundationId } from "./types";

export interface ExtensionFoundation {
  id:string;
  name:string;
  description:string;
  baseFoundation:FoundationId;
  direction?:Partial<Omit<DesignDirection,"foundation">>;
  tokens?:Partial<DesignTokens>;
  guidance?:string;
}
export interface ExtensionSkill {
  id:string;
  name:string;
  description:string;
  scope:"selection"|"page";
  instruction:string;
}
export interface ExtensionManifest {
  schema:"ai-design-canvas/extension/v1";
  id:string;
  name:string;
  version:string;
  description:string;
  author?:string;
  foundations?:ExtensionFoundation[];
  skills?:ExtensionSkill[];
}
const ID=/^[a-z0-9][a-z0-9._-]{1,79}$/;
export function parseExtensionManifest(source:string):ExtensionManifest{
  let raw:unknown;try{raw=JSON.parse(source);}catch(error){throw new Error(`Invalid extension JSON: ${error instanceof Error?error.message:String(error)}`);}
  if(!raw||typeof raw!=="object")throw new Error("Extension must be an object.");
  const value=raw as Partial<ExtensionManifest>;
  if(value.schema!=="ai-design-canvas/extension/v1")throw new Error("Unsupported extension schema.");
  if(!value.id||!ID.test(value.id)||!value.name||!value.version||!value.description)throw new Error("Extension id/name/version/description are required.");
  for(const foundation of value.foundations||[]){
    if(!ID.test(foundation.id)||!foundation.name||!foundation.description)throw new Error("Invalid foundation contribution.");
    if(!["linear","stripe","vercel","attio","raycast"].includes(foundation.baseFoundation))throw new Error(`Unknown base foundation: ${foundation.baseFoundation}`);
  }
  for(const skill of value.skills||[]){
    if(!ID.test(skill.id)||!skill.name||!skill.description||!skill.instruction||!["selection","page"].includes(skill.scope))throw new Error("Invalid skill contribution.");
    if(skill.instruction.length>6000)throw new Error(`Skill ${skill.id} instruction exceeds 6000 characters.`);
  }
  return value as ExtensionManifest;
}
const STORAGE="ai-design-canvas.extensions.v1";
export function loadExtensions():ExtensionManifest[]{
  if(typeof window==="undefined")return[];
  try{const raw=JSON.parse(localStorage.getItem(STORAGE)||"[]");return Array.isArray(raw)?raw.flatMap((item)=>{try{return[parseExtensionManifest(JSON.stringify(item))];}catch{return[];}}):[];}catch{return[];}
}
export function saveExtensions(extensions:ExtensionManifest[]){if(typeof window!=="undefined")localStorage.setItem(STORAGE,JSON.stringify(extensions));}
export function installExtension(extension:ExtensionManifest){
  const current=loadExtensions();const next=[...current.filter((item)=>item.id!==extension.id),extension].sort((a,b)=>a.name.localeCompare(b.name));saveExtensions(next);return next;
}
export function uninstallExtension(id:string){const next=loadExtensions().filter((item)=>item.id!==id);saveExtensions(next);return next;}

function retokenize(project:DesignProject,oldTokens:DesignTokens,nextTokens:DesignTokens){
  const pairs=Object.keys(oldTokens.colors).map((key)=>{const k=key as keyof DesignTokens["colors"];return[oldTokens.colors[k],nextTokens.colors[k]] as const;});
  const replace=(value?:string)=>pairs.find(([from])=>from===value)?.[1]||value;
  for(const page of project.pages){page.background=replace(page.background)||page.background;for(const node of page.nodes){node.style.background=replace(node.style.background);node.style.color=replace(node.style.color);node.style.borderColor=replace(node.style.borderColor);}}
}
export function applyExtensionFoundation(project:DesignProject,extension:ExtensionManifest,foundation:ExtensionFoundation){
  const next=structuredClone(project),oldTokens=next.tokens;
  const direction:DesignDirection={...next.direction,foundation:foundation.baseFoundation,...(foundation.direction||{})};
  const tokens=mergeTokens(generateTokens(direction),foundation.tokens);
  retokenize(next,oldTokens,tokens);next.direction=direction;next.tokens=tokens;
  const prose=parseDesignMd(next.designMd).prose;
  const note=`## Extension foundation · ${foundation.name}\n\nSource: ${extension.name} ${extension.version}.\n\n${foundation.guidance||foundation.description}`;
  next.designMd=serializeDesignMd(next.name,direction,tokens,`${prose}\n\n${note}`.trim());
  next.updatedAt=new Date().toISOString();return next;
}
export const EXTENSION_SKILL_EVENT="ai-design-canvas:run-skill";
export function dispatchExtensionSkill(extension:ExtensionManifest,skill:ExtensionSkill){
  if(typeof window==="undefined")return;
  window.dispatchEvent(new CustomEvent(EXTENSION_SKILL_EVENT,{detail:{extensionId:extension.id,skillId:skill.id,name:skill.name,scope:skill.scope,instruction:skill.instruction}}));
}
