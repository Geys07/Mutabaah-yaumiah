import { createClient } from "npm:@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")??"";
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")??"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
function normalizePhone(v:unknown){const d=String(v??"").replace(/\D/g,"");return d.startsWith("62")?"0"+d.slice(2):d;}
async function authorized(req:Request) {
 const bearer=req.headers.get("Authorization")??"";
 if(!bearer.startsWith("Bearer "))return false;
 const {data,error}=await admin.auth.getUser(bearer.slice(7).trim());
 if(error||!data.user)return false;
 const id=data.user.id;
 const [r,p]=await Promise.all([
  admin.from("user_roles").select("role").eq("user_id",id).eq("role","admin").maybeSingle(),
  admin.from("profiles").select("account_status").eq("user_id",id).maybeSingle()
 ]);
 return !r.error&&!p.error&&!!r.data&&p.data?.account_status==="active";
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return reply({});
 if(req.method!=="POST")return reply({error:"Metode tidak diizinkan."},405);
 try {
  if(!url||!anonKey||!serviceKey)return reply({error:"Konfigurasi server belum lengkap."},503);
  if(!await authorized(req))return reply({error:"Hanya Admin aktif yang dapat membuat akun staf."},403);
  let body:Record<string,unknown>;
  try{body=await req.json();}catch{return reply({error:"Format permintaan tidak valid."},400);}
  const role=String(body.role??"homeroom_teacher");
  const name=String(body.full_name??body.name??"").trim().replace(/\s+/g," ");
  const username=String(body.username??"").trim().toLowerCase();
  const phone=normalizePhone(body.phone);
  const password=body.password;
  if(role!=="homeroom_teacher"&&role!=="principal")return reply({error:"Peran tidak diizinkan."},400);
  if(name.length<2||name.length>150)return reply({error:"Nama harus 2–150 karakter."},400);
  if(!/^[a-z][a-z0-9._-]{3,23}$/.test(username)||username==="admin")return reply({error:"Nama pengguna harus 4–24 karakter (huruf kecil, angka, titik, _ atau -) dan tidak boleh admin."},400);
  if(phone&&!/^08[0-9]{8,11}$/.test(phone))return reply({error:"Nomor HP tidak valid."},400);
  if(typeof password!=="string"||password.length<10||password.length>72)return reply({error:"Kata sandi harus 10–72 karakter."},400);
  const [u,p]=await Promise.all([
    admin.from("profiles").select("user_id").eq("username",username).maybeSingle(),
    phone?admin.from("profiles").select("user_id").eq("phone",phone).maybeSingle():Promise.resolve({data:null,error:null})
  ]);
  if(u.error||p.error)return reply({error:"Gagal memeriksa nama pengguna."},500);
  if(u.data)return reply({error:"Nama pengguna sudah digunakan."},409);
  if(p.data)return reply({error:"Nomor HP sudah digunakan."},409);
  // Auth membutuhkan email internal; pengguna hanya melihat dan mengetik username.
  const email="staff-"+crypto.randomUUID()+"@accounts.example.com";
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
  if(createError||!created.user)return reply({error:"Gagal membuat akun. Periksa kata sandi atau coba kembali."},400);
  const id=created.user.id;
  try{
   const {error:profileError}=await admin.from("profiles").upsert({user_id:id,full_name:name,phone:phone||null,username,account_status:"active"},{onConflict:"user_id"});
   if(profileError)throw profileError;
   const {error:roleError}=await admin.from("user_roles").insert({user_id:id,role});
   if(roleError)throw roleError;
  }catch(e){
   const {error:cleanupError}=await admin.auth.admin.deleteUser(id);
   if(cleanupError)console.error("create-staff: cleanup_failed");
   const msg=(e as {code?:string})?.code==="23505"?"Nama pengguna atau nomor HP sudah digunakan.":"Akun gagal disimpan.";
   return reply({error:msg},(e as {code?:string})?.code==="23505"?409:500);
  }
  return reply({success:true,user_id:id,message:"Akun staf berhasil dibuat."});
 }catch(e){console.error("create-staff: unexpected_error");return reply({error:"Terjadi gangguan server."},500);}
});