import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||3000);
const apiKey=process.env.OPENAI_API_KEY;
const model=process.env.OPENAI_MODEL||'gpt-4.1-mini';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.json':'application/json'};
const system=`Du bist Kivo, der freundliche deutschsprachige KI-Chatbot von JDEV-Scripts.de, einem FiveM Development Studio. Hilf bei FiveM, ESX, Lua, Installation, Konfiguration, Debugging und allgemeinen Fragen. Antworte präzise und verständlich. Nutze bei Fragen über JDEV-Scripts die folgenden geprüften Angaben, falls vorhanden. Erfinde niemals Preise, Produkteigenschaften, Lizenzen, Bestellungen, Supportkontakte oder interne Fakten. Wenn Informationen fehlen, sag das und verweise auf die offiziellen Kontaktmöglichkeiten der Website. Gib keine Geheimnisse oder API-Schlüssel aus.\n\nJDEV-WISSEN:\n${await fs.readFile(path.join(root,'wissen.txt'),'utf8')}`;
const clients=new Map();
const allowedOrigins=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&allowedOrigins.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');}
 if(req.method==='OPTIONS') {res.writeHead(origin&&allowedOrigins.includes(origin)?204:403);return res.end();}
 if(origin&&!allowedOrigins.includes(origin))return json(res,403,{error:'Origin nicht erlaubt'});
 if(req.url==='/'&&req.method==='GET')return json(res,200,{status:'Kivo API online'});
 if(req.url?.split('?')[0]==='/api/kivo'){
  if(req.method!=='POST')return json(res,405,{error:'Methode nicht erlaubt'});
  const ip=req.socket.remoteAddress||'unknown';const now=Date.now();const recent=(clients.get(ip)||[]).filter(t=>now-t<60000);if(recent.length>=12)return json(res,429,{error:'Zu viele Nachrichten. Bitte warte kurz.'});recent.push(now);clients.set(ip,recent);
  if(!apiKey)return json(res,503,{error:'OPENAI_API_KEY ist auf dem Server noch nicht konfiguriert.'});
  try{let body='';for await(const chunk of req){body+=chunk;if(body.length>20000)return json(res,413,{error:'Nachricht zu groß'})}
   const payload=JSON.parse(body);if(!Array.isArray(payload.messages))return json(res,400,{error:'Ungültige Nachricht'});
   const messages=payload.messages.slice(-12).filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,2000)}));if(!messages.length||messages.at(-1).role!=='user')return json(res,400,{error:'Nachricht fehlt'});
   const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions:system,input:messages,max_output_tokens:700})});
   const result=await upstream.json();if(!upstream.ok){console.error('OpenAI error',upstream.status,result.error?.code);return json(res,502,{error:'KI-Anfrage fehlgeschlagen. Bitte später erneut versuchen.'})}
   const answer=(result.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n').trim();return json(res,200,{answer:answer||'Ich konnte gerade keine Antwort erzeugen.'});
  }catch(err){console.error('Kivo error',err);return json(res,500,{error:'Serverfehler beim Verarbeiten der Anfrage.'})}
 }
 return json(res,404,{error:'Nicht gefunden'});
});server.listen(port,'0.0.0.0',()=>console.log(`Kivo API bereit auf Port ${port}`));
