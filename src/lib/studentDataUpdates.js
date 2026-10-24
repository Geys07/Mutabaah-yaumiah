// Perubahan data siswa di dalam aplikasi dan antartab; pesan hanya sinyal, tanpa PII.
// Data tetap dibaca ulang melalui Supabase dengan pemeriksaan hak akses.
const EVENT_NAME="mutabaah:student-data-changed";
const CHANNEL_NAME="mutabaah-school-data-v1";
export function announceStudentDataChange(){
  if(typeof window==="undefined")return;
  window.dispatchEvent(new Event(EVENT_NAME));
  if("BroadcastChannel" in window){
    const channel=new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage("refresh");channel.close();
  }
}
export function listenStudentDataChanges(callback){
  if(typeof window==="undefined")return()=>{};
  const onChange=()=>callback();
  const onFocus=()=>{if(!document.hidden)callback();};
  window.addEventListener(EVENT_NAME,onChange);
  window.addEventListener("focus",onFocus);
  let channel;
  if("BroadcastChannel" in window){
    channel=new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message",onChange);
  }
  // Cadangan ringan untuk perubahan dari perangkat lain jika bukan tab aktif.
  const timer=window.setInterval(()=>{
    if(!document.hidden)callback();
  },45000);
  return()=>{
    window.removeEventListener(EVENT_NAME,onChange);
    window.removeEventListener("focus",onFocus);
    window.clearInterval(timer);
    if(channel){channel.removeEventListener("message",onChange);channel.close();}
  };
}
