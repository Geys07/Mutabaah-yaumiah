import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const URL = Deno.env.get("SUPABASE_URL") || "";
const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PEPPER = Deno.env.get("PASSWORD_RESET_PEPPER") || "";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "";
const db = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,apikey,content-type,x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
};
const reply = (value: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: HEADERS });
type Input = Record<string, unknown>;
const cleanPhone = (v: unknown) => {
  const x = String(v ?? "").replace(/\D/g, "");
  return x.startsWith("62") ? "0" + x.slice(2) : x;
};
const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const toHex = (arr: Uint8Array) => Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
const hash = async (text: string): Promise<string> =>
  toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
const newToken = () => toHex(crypto.getRandomValues(new Uint8Array(32)));
const friendly = (e: unknown): string => (e as { message?: string })?.message || "Permintaan belum berhasil.";

async function rateLimited(req: Request, phone: string) {
  const ip = String(req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0].trim().slice(0, 100);
  for (const key of ["ip:" + ip, "phone:" + phone]) {
    const { data, error } = await db.rpc("check_login_rate_limit", {
      p_key: await hash("recovery-chat:request:" + key),
    });
    if (error || data !== true) return true;
  }
  return false;
}

async function authorizedAdmin(req: Request) {
  const bearer = req.headers.get("authorization") || "";
  if (!bearer.startsWith("Bearer ")) return null;
  const { data, error } = await db.auth.getUser(bearer.slice(7));
  if (error || !data.user) return null;
  const [{ data: role }, { data: profile }] = await Promise.all([
    db.from("user_roles").select("user_id").eq("user_id", data.user.id).eq("role", "admin").maybeSingle(),
    db.from("profiles").select("account_status").eq("user_id", data.user.id).maybeSingle(),
  ]);
  return role && profile?.account_status === "active" ? data.user.id : null;
}

async function ticketByToken(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await db.from("recovery_chat_tickets").select("*")
    .eq("access_hash", await hash(token)).maybeSingle();
  if (!data || (data.delete_after && new Date(data.delete_after).getTime() <= Date.now())) return null;
  return data;
}

async function fetchRequest(ticket: { request_id: string }) {
  const { data, error } = await db.from("password_reset_requests")
    .select("id,status,reviewed_at,requested_at,used_at").eq("id", ticket.request_id).maybeSingle();
  if (error || !data) throw new Error("Permintaan pemulihan tidak ditemukan.");
  return data;
}

async function ticketDetail(ticket: Record<string, any>, owner: "user" | "admin") {
  const record = await fetchRequest(ticket);
  const { data: messages, error } = await db.from("recovery_chat_messages")
    .select("id,sender,body,created_at,read_at").eq("ticket_id", ticket.id)
    .order("created_at").order("id").limit(500);
  if (error) throw error;
  const outgoing = [];
  for (const msg of messages || []) {
    let body = msg.body;
    if (msg.sender === "code") {
      if (record.status !== "approved") body = "Kode sudah tidak aktif.";
      else body = await decrypt(body);
    }
    outgoing.push({ ...msg, body });
  }
  const seenSender = owner === "user" ? ["admin", "system", "code"] : ["user"];
  await db.from("recovery_chat_messages").update({ read_at: new Date().toISOString() })
    .eq("ticket_id", ticket.id).in("sender", seenSender).is("read_at", null);
  return {
    ticket_id: ticket.id, status: record.status, requested_at: record.requested_at,
    reviewed_at: record.reviewed_at, decided_at: ticket.decided_at,
    delete_after: ticket.delete_after, messages: outgoing,
  };
}

async function codeKey() {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PEPPER));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encrypt(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await codeKey(),
    new TextEncoder().encode(value));
  return "v1:" + btoa(String.fromCharCode(...iv)) + ":" +
    btoa(String.fromCharCode(...new Uint8Array(buf)));
}
async function decrypt(value: string): Promise<string> {
  try {
    const [version, ivText, dataText] = value.split(":");
    if (version !== "v1") return "Kode tidak tersedia.";
    const iv = Uint8Array.from(atob(ivText), (c) => c.charCodeAt(0));
    const data = Uint8Array.from(atob(dataText), (c) => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await codeKey(), data);
    return new TextDecoder().decode(plain);
  } catch {
    return "Kode tidak tersedia.";
  }
}

async function insertMessage(ticketId: string, sender: string, body: string) {
  const { error } = await db.from("recovery_chat_messages")
    .insert({ ticket_id: ticketId, sender, body });
  if (error) throw error;
  await db.from("recovery_chat_tickets").update({ last_message_at: new Date().toISOString() })
    .eq("id", ticketId);
}

async function sendPushToAdmins(kind: "request" | "message") {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) return;
  const { data: adminRoles } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = [...new Set((adminRoles || []).map((r: { user_id: string }) => r.user_id))];
  if (!adminIds.length) return;
  const { data: profiles } = await db.from("profiles").select("user_id")
    .in("user_id", adminIds).eq("account_status", "active");
  const ids = (profiles || []).map((p: { user_id: string }) => p.user_id);
  if (!ids.length) return;
  const { data: devices } = await db.from("admin_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth_key").in("user_id", ids).limit(500);
  if (!devices?.length) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const payload = JSON.stringify({
    title: "Pemulihan Kata Sandi",
    body: kind === "request" ? "Ada permintaan pemulihan kata sandi baru."
      : "Ada pesan baru pada chat pemulihan kata sandi.",
    tag: "chat-pemulihan-admin", url: "/",
  });
  await Promise.allSettled(devices.map(async (d: any) => {
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth_key } },
        payload, { TTL: 3600, timeout: 5000 });
    } catch (error) {
      if ([404, 410].includes((error as { statusCode?: number }).statusCode || 0)) {
        await db.from("admin_push_subscriptions").delete().eq("id", d.id).eq("user_id", d.user_id);
      }
    }
  }));
}

async function sendPushToApplicant(ticketId: string) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) return;
  const { data: devices } = await db.from("recovery_chat_push_subscriptions")
    .select("id,endpoint,p256dh,auth_key").eq("ticket_id", ticketId).limit(20);
  if (!devices?.length) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const payload = JSON.stringify({
    title: "Pesan Baru dari Admin",
    body: "Admin telah menanggapi pemulihan kata sandi Anda. Buka percakapan untuk melihatnya.",
    tag: "chat-pemulihan", url: "/",
  });
  await Promise.allSettled(devices.map(async (d: any) => {
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth_key } },
        payload, { TTL: 3600, timeout: 5000 });
    } catch (error) {
      if ([404, 410].includes((error as { statusCode?: number }).statusCode || 0))
        await db.from("recovery_chat_push_subscriptions").delete().eq("id", d.id).eq("ticket_id", ticketId);
    }
  }));
}

async function requestTicket(req: Request, body: Input) {
  const phone = cleanPhone(body.phone);
  if (!/^08[0-9]{8,11}$/.test(phone)) return reply({ error: "Nomor HP tidak valid." }, 400);
  if (await rateLimited(req, phone))
    return reply({ error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." }, 429);
  const { data: profile, error: findError } = await db.from("profiles")
    .select("user_id,account_status").eq("phone", phone).maybeSingle();
  if (findError) throw findError;
  if (!profile || profile.account_status !== "active")
    return reply({ error: "Nomor HP salah atau belum terdaftar. Silakan periksa kembali." }, 404);
  const { data: adminRole } = await db.from("user_roles").select("user_id")
    .eq("user_id", profile.user_id).eq("role", "admin").maybeSingle();
  if (adminRole) return reply({ error: "Pemulihan akun Admin ditangani secara terpisah." }, 403);
  const { data: existing, error: existingError } = await db.from("password_reset_requests")
    .select("id").eq("user_id", profile.user_id).in("status", ["pending", "approved", "processing"]).limit(1);
  if (existingError) throw existingError;
  if (existing?.length) return reply({
    error: "Permintaan sebelumnya masih aktif. Gunakan Lanjutkan Percakapan pada perangkat asal atau hubungi Admin sekolah.",
  }, 409);

  const { data: request, error: insertError } = await db.from("password_reset_requests")
    .insert({ user_id: profile.user_id, status: "pending" }).select("id").single();
  if (insertError || !request) {
    if (insertError?.code === "23505") return reply({ error: "Permintaan sebelumnya masih aktif." }, 409);
    throw insertError || new Error("Gagal membuat permintaan");
  }
  const token = newToken();
  const { data: ticket, error: ticketError } = await db.from("recovery_chat_tickets")
    .insert({ request_id: request.id, user_id: profile.user_id, access_hash: await hash(token) })
    .select("id").single();
  if (ticketError || !ticket) {
    await db.from("password_reset_requests").delete().eq("id", request.id);
    throw ticketError || new Error("Tidak dapat membuat chat pemulihan.");
  }
  try {
    await insertMessage(ticket.id, "system", "Permintaan pemulihan kata sandi diterima. Admin akan memeriksa permintaan Anda.");
  } catch (error) {
    await db.from("password_reset_requests").delete().eq("id", request.id);
    throw error;
  }
  await sendPushToAdmins("request");
  return reply({ success: true, token, status: "pending", ticket_id: ticket.id });
}

async function listForAdmin() {
  const { data: tickets, error } = await db.from("recovery_chat_tickets")
    .select("id,user_id,request_id,created_at,last_message_at,delete_after")
    .order("last_message_at", { ascending: false }).limit(200);
  if (error) throw error;
  if (!tickets?.length) return reply({ success: true, tickets: [] });
  const ids = [...new Set(tickets.map((t: any) => t.user_id))];
  const reqIds = tickets.map((t: any) => t.request_id);
  const [{ data: profiles }, { data: requests }, { data: unread }] = await Promise.all([
    db.from("profiles").select("user_id,full_name,phone").in("user_id", ids),
    db.from("password_reset_requests").select("id,status").in("id", reqIds),
    db.from("recovery_chat_messages").select("ticket_id").in("ticket_id",tickets.map((t: any)=>t.id))
      .eq("sender","user").is("read_at",null).limit(3000),
  ]);
  const byProfile = new Map((profiles||[]).map((p: any)=>[p.user_id,p]));
  const byRequest = new Map((requests||[]).map((p: any)=>[p.id,p]));
  const unreadCount = new Map<string,number>();
  for (const message of unread||[]) unreadCount.set(message.ticket_id,(unreadCount.get(message.ticket_id)||0)+1);
  return reply({ success:true, tickets:tickets.map((t:any)=>({
    id:t.id, full_name:byProfile.get(t.user_id)?.full_name||"Pengguna",
    phone:byProfile.get(t.user_id)?.phone||"",
    status:byRequest.get(t.request_id)?.status||"pending",
    created_at:t.created_at,last_message_at:t.last_message_at,delete_after:t.delete_after,
    unread:unreadCount.get(t.id)||0,
  }))});
}

async function adminTicket(ticketId: unknown) {
  if (!isUuid(ticketId)) return null;
  const {data} = await db.from("recovery_chat_tickets").select("*").eq("id",ticketId).maybeSingle();
  return data;
}

async function adminDetail(ticket: Record<string,any>) {
  const detail = await ticketDetail(ticket,"admin");
  const { data: profile } = await db.from("profiles").select("full_name,phone")
    .eq("user_id",ticket.user_id).maybeSingle();
  const students: string[] = [];
  const phone = profile?.phone || "";
  if (phone) {
    const { data: contacts } = await db.from("student_family_contacts")
      .select("student_id").eq("phone",phone).limit(60);
    const ids = [...new Set((contacts||[]).map((x:any)=>x.student_id))];
    if (ids.length) {
      const [{data: children},{data: enrollment}] = await Promise.all([
        db.from("students").select("id,full_name").in("id",ids),
        db.from("student_enrollments").select("student_id,class_id")
          .in("student_id",ids).is("ends_on",null),
      ]);
      const classIds=[...new Set((enrollment||[]).map((e:any)=>e.class_id))];
      const {data:classes} = classIds.length
        ? await db.from("classes").select("id,name").in("id",classIds)
        : {data:[]};
      const names=new Map((classes||[]).map((c:any)=>[c.id,c.name]));
      const current = new Map((enrollment||[]).map((e:any)=>[e.student_id,names.get(e.class_id)||""]));
      students.push(...(children||[]).map((child:any)=>
        child.full_name + (current.get(child.id)?" · "+current.get(child.id):"")));
    }
  }
  return reply({success:true,...detail,name:profile?.full_name||"Pengguna",phone,students});
}

async function postMessage(ticket: Record<string,any>, body: Input, from:"user"|"admin") {
  const text=String(body.message||"").trim();
  if (text.length<1 || text.length>600)
    return reply({error:"Pesan harus berisi 1–600 karakter."},400);
  const record=await fetchRequest(ticket);
  if (!["pending","approved"].includes(record.status))
    return reply({error:"Percakapan sudah ditutup. Pesan baru tidak dapat dikirim."},409);
  const {count}=await db.from("recovery_chat_messages").select("id",{count:"exact",head:true})
    .eq("ticket_id",ticket.id).eq("sender",from)
    .gte("created_at",new Date(Date.now()-60000).toISOString());
  if ((count||0)>=8) return reply({error:"Terlalu banyak pesan. Silakan lanjutkan sebentar lagi."},429);
  await insertMessage(ticket.id,from,text);
  if(from==="admin") await sendPushToApplicant(ticket.id);
  else await sendPushToAdmins("message");
  return reply({success:true});
}

async function adminReview(req:Request,ticket:Record<string,any>,decision:string){
  if(!["approve","reject"].includes(decision))
    return reply({error:"Pilihan keputusan tidak valid."},400);
  const record=await fetchRequest(ticket);
  if(record.status!=="pending")return reply({error:"Permintaan sudah diproses."},409);
  const url=URL+"/functions/v1/password-recovery";
  const response=await fetch(url,{
    method:"POST",
    headers:{ "content-type":"application/json", "apikey":SECRET,
      "authorization":req.headers.get("authorization")||""},
    body:JSON.stringify({action:"review",request_id:ticket.request_id,decision}),
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.success!==true)
    return reply({error:result.error||"Gagal memproses keputusan Admin."},response.status);
  try{
    if(decision==="approve"){
      const code=String(result.code||"");
      if(!/^[a-z]{4}$/.test(code)) throw new Error("Kode pemulihan tidak dapat dibaca");
      await insertMessage(ticket.id,"admin","Permintaan Anda disetujui. Gunakan kode berikut untuk mengganti kata sandi.");
      await insertMessage(ticket.id,"code",await encrypt(code));
    }else{
      await insertMessage(ticket.id,"admin","Permintaan pemulihan kata sandi tidak dapat disetujui. Silakan hubungi Admin Madrasah.");
    }
    await sendPushToApplicant(ticket.id);
  }catch {
    // Keputusan database sudah terjadi: jangan mengulang persetujuan.
    return reply({success:true,warning:"Keputusan tersimpan tetapi pesan otomatis gagal. Periksa tiket sebelum mengirim ulang."});
  }
  return reply({success:true});
}

async function subscribe(ticket:Record<string,any>,body:Input){
  const sub=body.subscription as { endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}}|null;
  const endpoint=typeof sub?.endpoint==="string"?sub.endpoint:"";
  const p256dh=typeof sub?.keys?.p256dh==="string"?sub.keys.p256dh:"";
  const auth_key=typeof sub?.keys?.auth==="string"?sub.keys.auth:"";
  if(!endpoint.startsWith("https://")||endpoint.length>2048||
     p256dh.length<24||p256dh.length>256||auth_key.length<10||auth_key.length>256)
     return reply({error:"Langganan perangkat tidak valid."},400);
  const {data:exists,error:lookupError}=await db.from("recovery_chat_push_subscriptions")
    .select("id,ticket_id").eq("endpoint",endpoint).maybeSingle();
  if(lookupError) throw lookupError;
  if(exists && exists.ticket_id!==ticket.id)
    return reply({error:"Perangkat ini masih digunakan oleh tiket pemulihan lain."},409);
  const values={ticket_id:ticket.id,endpoint,p256dh,auth_key};
  const {error}=exists
    ? await db.from("recovery_chat_push_subscriptions").update(values).eq("id",exists.id).eq("ticket_id",ticket.id)
    : await db.from("recovery_chat_push_subscriptions").insert(values);
  if(error)throw error;
  return reply({success:true});
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return reply({});
  if(req.method!=="POST")return reply({error:"Metode tidak didukung."},405);
  if(!URL||!SECRET||PEPPER.length<32)return reply({error:"Konfigurasi layanan belum siap."},503);
  try{
    const parsed=await req.json();
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
      return reply({error:"Data tidak valid."},400);
    const body=parsed as Input;
    const action=String(body.action||"");
    if(action==="request")return await requestTicket(req,body);
    if(action==="push_config")return reply({success:true,public_key:VAPID_PUBLIC||null});
    if(["my_chat","my_send","my_subscribe"].includes(action)){
      const ticket=await ticketByToken(body.token);
      if(!ticket)return reply({error:"Akses percakapan tidak tersedia. Ajukan pemulihan baru atau hubungi Admin."},403);
      if(action==="my_chat")return reply({success:true,...await ticketDetail(ticket,"user")});
      if(action==="my_send")return await postMessage(ticket,body,"user");
      return await subscribe(ticket,body);
    }
    if(["admin_list","admin_chat","admin_send","admin_review"].includes(action)){
      if(!await authorizedAdmin(req))return reply({error:"Hanya Admin aktif dapat mengakses percakapan."},403);
      if(action==="admin_list")return await listForAdmin();
      const ticket=await adminTicket(body.ticket_id);
      if(!ticket)return reply({error:"Percakapan tidak ditemukan."},404);
      if(action==="admin_chat")return await adminDetail(ticket);
      if(action==="admin_send")return await postMessage(ticket,body,"admin");
      return await adminReview(req,ticket,String(body.decision||""));
    }
    return reply({error:"Tindakan tidak dikenal."},400);
  }catch {
    console.error("recovery-chat: operation_failed");
    return reply({error:"Layanan pemulihan sedang mengalami gangguan."},500);
  }
});
