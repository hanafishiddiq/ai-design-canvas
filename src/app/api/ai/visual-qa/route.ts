import { NextRequest, NextResponse } from "next/server";
import { VISUAL_QA_AI_SCHEMA, validateVisualQaAiResult } from "@/lib/visual-qa-ai";
import type { DesignNode } from "@/lib/types";

export const runtime="nodejs";export const dynamic="force-dynamic";
function outputText(body:Record<string,unknown>){
  if(typeof body.output_text==="string")return body.output_text;
  for(const item of Array.isArray(body.output)?body.output:[]){if(!item||typeof item!=="object")continue;for(const part of Array.isArray((item as {content?:unknown}).content)?(item as {content:unknown[]}).content:[]){if(part&&typeof part==="object"&&(part as {type?:unknown}).type==="output_text"&&typeof (part as {text?:unknown}).text==="string")return (part as {text:string}).text;}}
  return null;
}
const image=(value:unknown)=>typeof value==="string"&&value.startsWith("data:image/")&&value.length<=5_500_000?value:null;

export async function POST(request:NextRequest){
  const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return NextResponse.json({error:"OpenAI visual QA is not configured."},{status:503});
  const length=Number(request.headers.get("content-length")||0);if(length>11_500_000)return NextResponse.json({error:"Visual QA request is too large."},{status:413});
  let body:{designImage?:unknown;implementationImage?:unknown;page?:unknown;designMd?:unknown;localReport?:unknown};
  try{body=await request.json();}catch{return NextResponse.json({error:"Request body must be JSON."},{status:400});}
  const designImage=image(body.designImage),implementationImage=image(body.implementationImage);
  if(!designImage||!implementationImage)return NextResponse.json({error:"Two image data URLs are required."},{status:400});
  if(!body.page||typeof body.page!=="object")return NextResponse.json({error:"Page context is required."},{status:400});
  const page=body.page as {id?:unknown;name?:unknown;width?:unknown;height?:unknown;nodes?:unknown};
  const nodes=Array.isArray(page.nodes)?page.nodes.filter((node):node is DesignNode=>!!node&&typeof node==="object").slice(0,180):[];
  const compact=nodes.map((node)=>({id:node.id,type:node.type,name:node.name,text:node.text||"",x:node.x,y:node.y,width:node.width,height:node.height,style:node.style,layout:node.layout||null,constraints:node.constraints||null}));
  const prompt=[
    "Compare the approved design screenshot (first image) with the implementation screenshot (second image).",
    "Classify meaningful implementation drift, not anti-aliasing noise. Use the supplied structured design nodes to anchor issues to node IDs when possible.",
    "Then propose bounded structured design actions that describe how the design-side/runtime mapping should be reconciled. Do not remove large regions unless clearly necessary. Prefer localized geometry/style/text fixes.",
    "The proposal schema uses the same bounded actions as AI Design Canvas AI Edit. Existing update/remove actions must reference supplied node IDs; inserts use nodeId null.",
    `Page: ${String(page.name||"Untitled")} ${Number(page.width)||0}x${Number(page.height)||0}`,
    `Deterministic local pixel report: ${JSON.stringify(body.localReport||{})}`,
    `DESIGN.md: ${typeof body.designMd==="string"?body.designMd.slice(0,6000):""}`,
    `Nodes: ${JSON.stringify(compact)}`,
  ].join("\n\n");
  const model=process.env.OPENAI_QA_MODEL||process.env.OPENAI_VISION_MODEL||"gpt-5.6-terra";
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{authorization:`Bearer ${apiKey}`,"content-type":"application/json"},body:JSON.stringify({
    model,store:false,reasoning:{effort:"low"},max_output_tokens:8000,
    input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:designImage,detail:"high"},{type:"input_image",image_url:implementationImage,detail:"high"}]}],
    text:{format:{type:"json_schema",name:"visual_qa_result",strict:true,schema:VISUAL_QA_AI_SCHEMA}},
  })});
  const responseBody=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok){const err=responseBody.error&&typeof responseBody.error==="object"?(responseBody.error as {message?:unknown}).message:null;return NextResponse.json({error:typeof err==="string"?err:`OpenAI returned ${response.status}.`},{status:response.status});}
  const text=outputText(responseBody);if(!text)return NextResponse.json({error:"Visual QA model returned no structured output."},{status:502});
  let result:unknown;try{result=JSON.parse(text);}catch{return NextResponse.json({error:"Visual QA model returned invalid JSON."},{status:502});}
  if(!validateVisualQaAiResult(result))return NextResponse.json({error:"Visual QA result failed semantic validation."},{status:502});
  return NextResponse.json({result,model,usage:responseBody.usage||null},{headers:{"cache-control":"no-store"}});
}
