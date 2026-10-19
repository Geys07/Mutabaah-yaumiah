// Integrated backend source. Deployment status is recorded in the implementation report.
import {createClient} from "npm:@supabase/supabase-js@2";
const sbUrl=Deno.env.get("SUPABASE_URL")||"";
const svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const vapid=Deno.env.get("VAPID_PUBLIC_KEY")||"";
const db=createClient(sbUrl,svc,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const send=(x:Record<string,unknown>,status=200)=>new Response(JSON.stringify(x),{status,headers});
function validSub(x:any){if(!x||typeof x.endpoint!=="string"||x.endpoint.length<20||x.endpoint.length>2048)return false;
try{const u=new URL(x.endpoint);if(u.protocol!=="https:"||!u.hostname||u.username||u.password||u.hash)return false}catch{return false}
return /^[A-Za-z0-9_-]{20,512}$/.test(x.keys?.p256dh||"")&&/^[A-Za-z0-9_-]{8,512}$/.test(x.keys?.auth||"")}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return send({});
 if(req.method!=="POST")return send({error:"Metode tidak didukung"},405);
 if(!sbUrl||!svc)return send({error:"Server belum dikonfigurasi"},503);
 try{
  const authorization=req.headers.get("authorization")||"";
  const jwt=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  if(!jwt)return send({error:"Login diperlukan"},401);
  const {data:user,error:authError}=await db.auth.getUser(jwt);
  if(authError||!user.user)return send({error:"Sesi tidak valid"},401);
  const id=user.user.id;
  const [role,profile]=await Promise.all([
   db.from("user_roles").select("role").eq("user_id",id).eq("role","parent").maybeSingle(),
   db.from("profiles").select("account_status").eq("user_id",id).maybeSingle()
  ]);
  if(role.error||profile.error||!role.data||profile.data?.account_status!=="active")return send({error:"Hanya untuk orang tua aktif"},403);
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body))return send({error:"Data permintaan tidak valid"},400);
  if(body.action==="config")return vapid?send({public_key:vapid}):send({error:"Kunci VAPID belum dikonfigurasi"},503);
  if(body.action==="status"){
   const {count,error}=await db.from("parent_push_subscriptions").select("id",{count:"exact",head:true}).eq("guardian_id",id);
   if(error)throw error;
   return send({subscribed_devices:count||0});
  }
  if(body.action==="subscribe"){
   const sub=body.subscription;
   if(!validSub(sub))return send({error:"Data perangkat tidak valid"},400);
   const values={guardian_id:id,endpoint:sub.endpoint,p256dh:sub.keys.p256dh,auth_key:sub.keys.auth,
    user_agent:(req.headers.get("user-agent")||"").slice(0,500),updated_at:new Date().toISOString(),last_error:null};
   const {error:insertError}=await db.from("parent_push_subscriptions").upsert(values,{onConflict:"endpoint",ignoreDuplicates:true});
   if(insertError?.code==="23505")return send({error:"Perangkat terhubung ke akun lain"},409);
   if(insertError?.code==="42501")return send({error:"Akun atau peran tidak aktif"},403);
   if(insertError)throw new Error("subscription_insert_failed");
   const {data:saved,error:saveError}=await db.from("parent_push_subscriptions").update(values)
    .eq("endpoint",sub.endpoint).eq("guardian_id",id).select("id").maybeSingle();
   if(saveError?.code==="23505")return send({error:"Perangkat terhubung ke akun lain"},409);
   if(saveError?.code==="42501")return send({error:"Akun atau peran tidak aktif"},403);
   if(saveError)throw new Error("subscription_save_failed");
   if(!saved)return send({error:"Perangkat terhubung ke akun lain"},409);
   return send({success:true});
  }
  if(body.action==="unsubscribe"){
   if(typeof body.endpoint!=="string"||body.endpoint.length>2048)return send({error:"Endpoint tidak valid"},400);
   const {error}=await db.from("parent_push_subscriptions").delete().eq("guardian_id",id).eq("endpoint",body.endpoint);
   if(error)throw error;
   return send({success:true});
  }
  return send({error:"Perintah tidak dikenal"},400);
 }catch(error){console.error("parent-push: operation_failed");return send({error:"Gangguan server"},500)}
});