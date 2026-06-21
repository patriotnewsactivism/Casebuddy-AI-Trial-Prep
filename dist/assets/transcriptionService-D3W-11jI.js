import{b as p,c as u,T as c,i as y}from"./index-BayMkqi8.js";const f=e=>e.customVocabulary.length>0?`VOCABULARY/GLOSSARY (Prioritize these spellings): ${e.customVocabulary.join(", ")}`:"",h=e=>`
You are an expert Audio Transcription AI.
${f(e)}

TASK:
Transcribe the audio accurately.
You MUST return the result as a raw JSON Array of objects. Just the JSON.

SCHEMA:
Array<{
  start: number; // Start time in seconds (e.g., 12.5)
  end: number;   // End time in seconds
  speaker: string; // e.g., "Speaker 1"
  text: string;    // The spoken text
}>

RULES:
1. Break text into natural sentence-level or phrase-level segments.
2. ${e.legalMode?"Verbatim mode: Keep ums, ahs, and stuttering.":'Clean mode: Remove stuttering, but correct phonetic errors (e.g. "reel a state" -> "real estate").'}
3. Identify speakers carefully.
4. ACCURACY: If you see specific words in the provided Vocabulary list, use them.
`,A=e=>{const n=Math.floor(e/60),r=Math.floor(e%60);return`${n}:${r.toString().padStart(2,"0")}`},x=e=>{if(!e||typeof e!="object")return!1;const n=e;return typeof n.start=="number"&&typeof n.end=="number"&&typeof n.text=="string"},S=e=>{const n=t=>{try{return JSON.parse(t)}catch{return null}},r=e.match(/\[[\s\S]*\]/);let a=n(e)??(r?n(r[0]):null);if(a&&typeof a=="object"&&!Array.isArray(a)){const t=a;Array.isArray(t.segments)&&(a=t.segments)}if(!Array.isArray(a))throw new Error("Transcription failed: Model did not return segment array JSON");const o=a.filter(x).map((t,i)=>({start:t.start,end:t.end,speaker:typeof t.speaker=="string"&&t.speaker.trim().length>0?t.speaker:`Speaker ${i+1}`,text:t.text.trim()})).filter(t=>t.text.length>0);if(o.length===0)throw new Error("Transcription failed: No valid transcript segments returned");return o},b=async e=>new Promise((n,r)=>{const s=new FileReader;s.onloadend=()=>{const o=s.result.split(",")[1];n({data:o,mimeType:e.type||"audio/mpeg"})},s.onerror=r,s.readAsDataURL(e)}),g=async(e,n,r)=>{var s;try{r&&r(10);const{data:a,mimeType:o}=await b(e);r&&r(30);const t=h(n),i=await u({prompt:"Transcribe the attached audio accurately following the provided rules. Output only the JSON array.",systemPrompt:t,model:"gemini-2.5-flash",inlineData:{data:a,mimeType:o},options:{responseMimeType:"application/json",responseSchema:{type:c.ARRAY,items:{type:c.OBJECT,properties:{start:{type:c.NUMBER},end:{type:c.NUMBER},speaker:{type:c.STRING},text:{type:c.STRING}},required:["start","end","speaker","text"]}}}});if(!i.success||!i.text)throw new Error(((s=i.error)==null?void 0:s.message)||"Transcription failed: No response text received");const l=S(i.text),m=l.map(d=>`[${A(d.start)}] [${d.speaker}] ${d.text}`).join(`
`);return r&&r(100),{text:m,segments:l,providerUsed:p.GEMINI}}catch(a){throw console.error("Gemini transcription via proxy failed:",a),a}},T=async(e,n)=>{var o;const r=e instanceof File?e:new File([e],"audio.wav",{type:e.type}),s=await y(r);if(!s.success)throw new Error(((o=s.error)==null?void 0:o.message)||"OpenAI Whisper transcription failed");const a=(s.segments||[]).map(t=>({start:t.start,end:t.end,speaker:t.speaker||"Speaker",text:t.text}));return{text:s.text,segments:a.length>0?a:void 0,providerUsed:p.OPENAI}},k=async(e,n,r,s)=>{switch(r.provider){case p.OPENAI:return await T(e);case p.GEMINI:default:return await g(e,r,s)}};export{k as t};
