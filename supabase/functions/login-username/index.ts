import { createClient } from "npm:@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")??"";
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")??"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"}});
const denied=()=>reply({error:"Nama pengguna/nomor HP atau kata sandi salah."},401);
async function sha256(v:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,"0")).join("");}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return reply({});
 if(req.method!=="POST")return reply({error:"Metode tidak diizinkan."},405);
 try {
  if(!url||!anonKey||!serviceKey)return reply({error:"Konfigurasi server belum lengkap."},503);
  const body=await req.json();
  const identifier=String(body?.identifier??"").trim().toLowerCase();
  const password=body?.password;
  const phone=/^08[0-9]{8,11}$/.test(identifier);
  const username=/^[a-z][a-z0-9._-]{3,23}$/.test(identifier);
  if(!(phone||username)||typeof password!=="string"||password.length<1||password.length>256)return reply({error:"Nama pengguna/nomor HP atau kata sandi tidak valid."},400);
  const ip=(req.headers.get("x-forwarded-for")??"unknown").split(",")[0].trim().slice(0,100);
  const limitKey=await sha256(ip+"|"+identifier);
  const {data:allowed,error:limitError}=await admin.rpc("check_login_rate_limit",{p_key:limitKey});
  if(limitError||!allowed)return reply({error:"Terlalu banyak percobaan. Coba lagi dalam 15 menit."},429);
  let uid:string|null=null;
  if(identifier==="admin"){
   const {data,error}=await admin.from("user_roles").select("user_id").eq("role","admin").limit(2);
   if(error||data?.length!==1)return denied();
   uid=data[0].user_id;
  } else {
   const {data,error}=await admin.from("profiles")
     .select("user_id,account_status").eq(phone?"phone":"username",identifier).maybeSingle();
   if(error||!data||data.account_status!=="active")return denied();
   uid=data.user_id;
  }
  // Setelah uid diketahui, jalankan pemeriksaan yang independen secara paralel.
  // Non-admin sudah diverifikasi aktif pada query identitas di atas.
  const [userLookup,roleLookup,adminProfileLookup]=await Promise.all([
   admin.auth.admin.getUserById(uid),
   !phone && identifier!=="admin"
     ? admin.from("user_roles").select("role").eq("user_id",uid)
         .in("role",["homeroom_teacher","principal"]).limit(1)
     : Promise.resolve(null),
   identifier==="admin"
     ? admin.from("profiles").select("account_status").eq("user_id",uid).maybeSingle()
     : Promise.resolve(null),
  ]);
  if(roleLookup && (roleLookup.error||!roleLookup.data?.length))return denied();
  if(adminProfileLookup && (adminProfileLookup.error||
     adminProfileLookup.data?.account_status!=="active"))return denied();
  const {data:userData,error:userError}=userLookup;
  if(userError||!userData.user?.email)return denied();
  const {data:session,error:loginError}=await client.auth.signInWithPassword({email:userData.user.email,password});
  if(loginError||!session.session)return denied();
  return reply({access_token:session.session.access_token,refresh_token:session.session.refresh_token});
 }catch{return reply({error:"Terjadi gangguan server. Silakan coba kembali."},500)}
});