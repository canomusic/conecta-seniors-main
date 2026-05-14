import { useEffect, useState, useCallback } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from '../supabaseClient';
import {
  ArrowLeft, Heart, ListChecks, Users, User as UserIcon, 
  Send, LogOut, Phone, PhoneForwarded, CheckCircle2, Circle, AlertTriangle, Clock, MapPin, Check
} from "lucide-react";

type Screen = "login" | "name_step" | "f_name_step" | "home" | "tasks" | "video" | "family" | "emergency" | "profile" | "family_admin";
type Task = { id: string; title: string; completed: boolean; task_time?: string; pin: string };
type Message = { text: string; sender_name: string; created_at: string; pin: string };
type Location = { lat: number; lng: number; updated_at: string };

export default function Index() {
  const [showSplash, setShowSplash] = useState(true);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  // --- CONTROL DE PANTALLA INICIAL ---
  const [screen, setScreen] = useState<Screen>(() => {
    const isLogged = localStorage.getItem("is_logged");
    const role = localStorage.getItem("user_role");
    const name = localStorage.getItem("user_name");
    const fName = localStorage.getItem("family_name");

    if (isLogged === "true") {
      if (role === "family" && fName) return "family_admin";
      if (role === "senior" && name) return "home";
    }
    return "login"; // Si falta algo, siempre al inicio (image_a13341.png)
  });

  const [name, setName] = useState(() => localStorage.getItem("user_name") || "");
  const [familyName, setFamilyName] = useState(() => localStorage.getItem("family_name") || "");
  const [seniorPhone, setSeniorPhone] = useState(() => localStorage.getItem("senior_phone") || "");
  const [familyPhone, setFamilyPhone] = useState(() => localStorage.getItem("family_phone") || "");
  const [role, setRole] = useState(() => localStorage.getItem("user_role") || "senior");
  const [seniorCode, setSeniorCode] = useState(() => localStorage.getItem("senior_code") || "");
  
  const [dbTasks, setDbTasks] = useState<Task[]>([]);
  const [dbMessages, setDbMessages] = useState<Message[]>([]);
  const [lastWellness, setLastWellness] = useState<string | null>(null);
  const [seniorLocation, setSeniorLocation] = useState<Location | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 4500);
    return () => clearTimeout(timer);
  }, []);

  // --- GPS Y PERMISOS ---
  const startTracking = useCallback(() => {
    if (role === "senior" && seniorCode) {
      const saveLoc = async (lat: number, lng: number) => {
        await supabase.from('locations').upsert([{ pin: seniorCode, lat, lng, updated_at: new Date().toISOString() }]);
      };
      navigator.geolocation.watchPosition(
        (pos) => saveLoc(pos.coords.latitude, pos.coords.longitude),
        () => saveLoc(40.4168, -3.7038), // Rescate Madrid
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [role, seniorCode]);

  useEffect(() => {
    if (role === "senior" && screen === "home") {
      if (localStorage.getItem("location_accepted") === "true") startTracking();
      else setShowLocationPrompt(true);
    }
  }, [screen, role, startTracking]);

  const fetchData = useCallback(async () => {
    if (!seniorCode) return;
    const { data: pD } = await supabase.from('family_pins').select('*').eq('pin', seniorCode).single();
    if (pD) {
      if (pD.family_name) setFamilyName(pD.family_name);
      if (pD.family_phone) setFamilyPhone(pD.family_phone);
      if (pD.senior_name) setName(pD.senior_name);
      if (pD.senior_phone) setSeniorPhone(pD.senior_phone);
    }
    const { data: tk } = await supabase.from('tasks').select('*').eq('pin', seniorCode).order('created_at', { ascending: false });
    if (tk) setDbTasks(tk);
    const { data: ms } = await supabase.from('messages').select('*').eq('pin', seniorCode).order('created_at', { ascending: false });
    if (ms) setDbMessages(ms);
    const { data: wl } = await supabase.from('messages').select('created_at').eq('text', 'ESTOY_BIEN_SIGNAL').eq('pin', seniorCode).order('created_at', { ascending: false }).limit(1);
    if (wl?.[0]) setLastWellness(new Date(wl[0].created_at).toLocaleTimeString());
    const { data: lc } = await supabase.from('locations').select('*').eq('pin', seniorCode).single();
    if (lc) setSeniorLocation(lc);
  }, [seniorCode]);

  useEffect(() => {
    if (['login', 'name_step', 'f_name_step'].includes(screen)) return;
    fetchData();
    const sub = supabase.channel('api').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchData, screen]);

  return (
    <div className="h-screen bg-[#F8F9FA] flex justify-center font-sans overflow-hidden text-slate-800">
      <Toaster position="top-center" />
      <main className="w-full max-w-md bg-[#F8F9FA] relative h-full flex flex-col shadow-2xl overflow-hidden">
        
        {showLocationPrompt && (
          <div className="absolute inset-0 z-[100] bg-black/60 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[40px] p-8 w-full shadow-2xl text-center">
              <MapPin size={40} className="text-primary mx-auto mb-4 animate-bounce" />
              <h2 className="text-2xl font-black mb-2">¿Compartir ubicación?</h2>
              <p className="text-slate-500 font-bold mb-6">Tu familia podrá cuidarte mejor si saben dónde estás.</p>
              <button onClick={() => { localStorage.setItem("location_accepted", "true"); setShowLocationPrompt(false); startTracking(); }} className="w-full bg-primary text-white py-4 rounded-2xl font-black mb-2">SÍ, COMPARTIR</button>
              <button onClick={() => setShowLocationPrompt(false)} className="w-full text-slate-300 font-bold">Ahora no</button>
            </div>
          </div>
        )}

        {showSplash ? <SplashScreen /> : (
          <>
            {screen === "login" && <Login onAccess={(r: any, c: any, n?: any, p?: any) => { setRole(r); setSeniorCode(c); localStorage.setItem("is_logged", "true"); localStorage.setItem("user_role", r); localStorage.setItem("senior_code", c); if (r === "family") { if (n) { setFamilyName(n); setScreen("family_admin"); } else setScreen("f_name_step"); } else { if (n) { setName(n); setScreen("home"); } else setScreen("name_step"); } }} />}
            {screen === "name_step" && <NameAndPhoneStep title="¿Cómo te llamas?" onNext={async (n: any, p: any) => { setName(n); localStorage.setItem("user_name", n); await supabase.from('family_pins').update({ senior_name: n, senior_phone: p }).eq('pin', seniorCode); setScreen("home"); }} />}
            {screen === "f_name_step" && <NameAndPhoneStep title="¿Quién eres?" onNext={async (n: any, p: any) => { setFamilyName(n); localStorage.setItem("family_name", n); await supabase.from('family_pins').update({ family_name: n, family_phone: p }).eq('pin', seniorCode); setScreen("family_admin"); }} />}
            {screen === "home" && <Home name={name} latestTask={dbTasks[0]} onWellness={() => supabase.from('messages').insert([{ text: 'ESTOY_BIEN_SIGNAL', sender_name: name, pin: seniorCode }])} go={setScreen} />}
            {screen === "tasks" && <TasksListView tasks={dbTasks} onToggle={(id:any, s:any)=>supabase.from('tasks').update({completed:!s}).eq('id',id)} back={() => setScreen("home")} />}
            {screen === "family" && <FamilySeniorView location={seniorLocation} messages={dbMessages} back={() => setScreen("home")} />}
            {screen === "profile" && <Profile name={name} code={seniorCode} phone={seniorPhone} onLogout={() => { localStorage.clear(); window.location.reload(); }} back={() => setScreen("home")} />}
            {screen === "emergency" && <Emergency cancel={() => setScreen("home")} />}
            {screen === "video" && <VideoCallsView fName={familyName} fPhone={familyPhone} back={() => setScreen("home")} />}
            {screen === "family_admin" && <FamilyAdmin fName={familyName} seniorName={name} sPhone={seniorPhone} location={seniorLocation} lastWellness={lastWellness} seniorCode={seniorCode} onLogout={() => { localStorage.clear(); window.location.reload(); }} />}
          </>
        )}
      </main>
    </div>
  );
}

/* --- PANEL FAMILIAR (TODO INCLUIDO) --- */
function FamilyAdmin({ fName, seniorName, sPhone, location, lastWellness, seniorCode, onLogout }: any) {
  const [taskIn, setTaskIn] = useState(""); const [timeIn, setTimeIn] = useState(""); const [msgIn, setMsgIn] = useState("");
  const addTask = async () => { if(!taskIn) return; await supabase.from('tasks').insert([{ title: taskIn, task_time: timeIn, completed: false, pin: seniorCode }]); setTaskIn(""); setTimeIn(""); toast.success("Tarea enviada"); };
  const sendMsg = async () => { if(!msgIn) return; await supabase.from('messages').insert([{ text: msgIn, sender_name: fName, pin: seniorCode }]); setMsgIn(""); toast.success("Mensaje enviado"); };
  return (
    <div className="h-full flex flex-col p-6 bg-[#F8F9FA] overflow-y-auto pb-10">
      <div className="flex justify-between items-center bg-white p-5 rounded-[30px] shadow-sm mb-6">
        <div><p className="text-[10px] font-black text-slate-400 uppercase">Bienvenido/a</p><h1 className="text-xl font-black text-primary italic">{fName}</h1></div>
        <button onClick={onLogout} className="p-2 bg-red-50 text-red-500 rounded-xl"><LogOut size={22}/></button>
      </div>
      <div className="bg-white p-6 rounded-[35px] shadow-sm mb-4 border">
        <p className="text-[10px] font-black text-primary uppercase mb-4 tracking-widest">Ubicación de {seniorName || "Abuelo/a"}</p>
        {location ? <MapView lat={location.lat} lng={location.lng} /> : <div className="p-8 bg-slate-50 rounded-3xl text-center text-slate-400 font-bold animate-pulse">Buscando señal GPS...</div>}
      </div>
      <button onClick={() => sPhone && (window.location.href = `tel:${sPhone}`)} className="w-full bg-[#1EA851] text-white p-6 rounded-[35px] font-black text-xl flex items-center justify-center gap-3 mb-6 shadow-lg active:scale-95 transition"><Phone fill="white"/> LLAMAR A {seniorName?.toUpperCase() || "ABUELO/A"}</button>
      <div className="bg-white p-5 rounded-[30px] border-2 border-green-100 mb-6 flex justify-between items-center">
        <div><p className="text-[10px] font-black text-green-600 uppercase tracking-tighter">Estado Bienestar</p><p className="text-lg font-black">{lastWellness ? `Aviso: ${lastWellness}` : "Sin avisos hoy"}</p></div>
        <Heart fill={lastWellness ? "#22C55E" : "#CBD5E1"} className={lastWellness ? "text-green-500" : "text-slate-300"}/>
      </div>
      <div className="bg-white p-6 rounded-[35px] shadow-sm border mb-4">
        <p className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Asignar Tarea con Hora</p>
        <div className="space-y-2"><div className="flex gap-2">
          <input type="time" className="p-3 bg-blue-50 rounded-xl font-black text-primary outline-none" value={timeIn} onChange={e=>setTimeIn(e.target.value)} />
          <input className="flex-1 p-3 bg-slate-50 rounded-xl font-bold outline-none" value={taskIn} onChange={e=>setTaskIn(e.target.value)} placeholder="Ej: Medicina"/>
        </div><button onClick={addTask} className="w-full bg-primary text-white p-3 rounded-xl font-black flex justify-center gap-2">AÑADIR TAREA <ListChecks/></button></div>
      </div>
      <div className="bg-white p-6 rounded-[35px] shadow-sm border">
        <p className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Mensaje rápido</p>
        <div className="flex gap-2">
          <input className="flex-1 p-3 bg-slate-50 rounded-xl font-bold outline-none" value={msgIn} onChange={e=>setMsgIn(e.target.value)} placeholder="Escribe aquí..."/>
          <button onClick={sendMsg} className="bg-primary text-white p-3 rounded-xl shadow-md"><Send size={20}/></button>
        </div>
      </div>
    </div>
  );
}

/* --- SPLASH SCREEN --- */
function SplashScreen() {
  return (
    <div className="h-full bg-primary flex flex-col items-center justify-center p-6 text-white relative z-50">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white/20 rounded-full blur-3xl"></div>
      <div className="relative w-full max-w-[320px] aspect-[4/3] mt-8 mb-12">
        <img src="/foto1.jpg" alt="Portada" className="w-full h-full object-cover rounded-3xl border-4 border-white/20 shadow-2xl" />
        <div className="absolute -bottom-4 -right-4 bg-white p-4 rounded-full shadow-2xl"><Heart className="text-[#E5484D]" fill="#E5484D" size={30} /></div>
      </div>
      <h1 className="text-5xl font-black tracking-tighter mb-4">ConectaMayores</h1>
      <p className="text-blue-100 font-bold text-xl mb-12">Tu familia, siempre cerca.</p>
      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
    </div>
  );
}

/* --- RESTO DE COMPONENTES --- */
function MapView({ lat, lng }: any) { const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.005},${lat-0.005},${lng+0.005},${lat+0.005}&layer=mapnik&marker=${lat},${lng}`; return ( <div className="w-full h-48 rounded-3xl overflow-hidden border-2 border-blue-100 relative shadow-inner"> <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={mapUrl} style={{ border: 0 }} /> </div> ); }
function Login({ onAccess }: any) { const [view, setView] = useState<any>("choice"); const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [code, setCode] = useState(""); const [regN, setRegN] = useState(""); const [regP, setRegP] = useState(""); const handleF = async (m:any) => { const { error } = m === 'reg' ? await supabase.auth.signUp({ email, password: pass }) : await supabase.auth.signInWithPassword({ email, password: pass }); if (error) return toast.error(error.message); if (m === 'reg') await supabase.from('family_pins').upsert([{ pin: code, family_name: regN, family_phone: regP }]); const { data: pD } = await supabase.from('family_pins').select('*').eq('pin', code).single(); onAccess("family", code, pD?.family_name, pD?.family_phone); }; return ( <div className="p-8 flex flex-col h-full bg-white items-center justify-center animate-in fade-in"> <div className="mb-6 bg-primary p-6 rounded-[35px] shadow-xl shadow-blue-100"><Heart fill="white" className="text-white w-12 h-12" /></div> <h1 className="text-4xl font-black text-center mb-8 tracking-tighter">ConectaMayores</h1> {view === "choice" && <div className="w-full space-y-4"><button onClick={() => setView("s_code")} className="w-full bg-primary text-white p-8 rounded-[45px] text-3xl font-black shadow-lg">Soy Abuela/o</button><div className="flex gap-2"><button onClick={() => setView("f_login")} className="flex-1 bg-white text-slate-600 p-5 rounded-[30px] font-bold border-2">Entrar</button><button onClick={() => setView("f_reg")} className="flex-1 bg-slate-50 text-primary p-5 rounded-[30px] font-bold border-2">Registrar</button></div></div>} {view === "s_code" && <div className="w-full space-y-8"><h2 className="text-2xl font-black text-center">PIN de Acceso</h2><input type="number" className="w-full p-8 bg-slate-50 rounded-[35px] text-6xl font-black text-center border-4 border-primary/10 outline-none" value={code} onChange={e => setCode(e.target.value)} /><button onClick={async () => { const { data } = await supabase.from('family_pins').select('*').eq('pin', code).single(); if (data) onAccess("senior", code, data.senior_name, data.senior_phone); else toast.error("PIN no válido"); }} className="w-full bg-[#1EA851] text-white p-6 rounded-[35px] text-2xl font-black shadow-lg uppercase">Entrar</button><button onClick={() => setView("choice")} className="w-full text-slate-400 font-bold">Volver</button></div>} {view === "f_login" && <div className="w-full space-y-3"><input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" type="password" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} /><input className="w-full p-4 bg-blue-50 border rounded-2xl font-bold outline-none" placeholder="PIN familiar" value={code} onChange={e => setCode(e.target.value)} /><button onClick={()=>handleF('log')} className="w-full bg-primary text-white p-4 rounded-2xl font-black">ENTRAR</button><button onClick={() => setView("choice")} className="w-full text-slate-400 font-bold mt-2">Volver</button></div>} {view === "f_reg" && <div className="w-full space-y-3"><input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none text-sm" placeholder="Tu Nombre" value={regN} onChange={e => setRegN(e.target.value)} /><input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none text-sm" placeholder="Tu Teléfono" value={regP} onChange={e => setRegP(e.target.value)} /><input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none text-sm" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none text-sm" type="password" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} /><input className="w-full p-4 bg-blue-50 border rounded-2xl font-bold outline-none text-sm" placeholder="Crea un PIN" value={code} onChange={e => setCode(e.target.value)} /><button onClick={()=>handleF('reg')} className="w-full bg-[#1EA851] text-white p-4 rounded-2xl font-black">REGISTRAR</button></div>} </div> ); }
function Home({ name, latestTask, onWellness, go }: any) { return ( <div className="p-6 flex flex-col h-full justify-between animate-in fade-in duration-700"> <h1 className="text-4xl font-black mt-4 italic">Hola, <span className="text-primary">{name}</span> 👋</h1> <div className="p-8 bg-white rounded-[45px] shadow-sm border-2 border-dashed border-blue-100 min-h-[160px] flex flex-col justify-center"> <p className="text-[10px] font-black text-slate-300 uppercase mb-2 tracking-widest">Siguiente tarea:</p> <div className="flex items-start gap-3"> {latestTask?.task_time && <span className="bg-primary/10 text-primary px-3 py-1 rounded-xl font-black text-lg flex items-center gap-1 shrink-0"><Clock size={18}/> {latestTask.task_time}</span>} <p className="text-2xl font-bold text-slate-700 leading-tight">{latestTask ? `"${latestTask.title}"` : "¡Todo libre!"}</p> </div> </div> <div className="grid grid-cols-2 gap-4"> <NavBtn icon={<ListChecks size={40} className="text-primary"/>} label="Tareas" onClick={()=>go("tasks")}/> <NavBtn icon={<PhoneForwarded size={40} className="text-primary"/>} label="Llamadas" onClick={()=>go("video")}/> <NavBtn icon={<Users size={40} className="text-primary"/>} label="Familia" onClick={()=>go("family")}/> <NavBtn icon={<UserIcon size={40} className="text-primary"/>} label="Perfil" onClick={()=>go("profile")}/> </div> <button onClick={()=>{onWellness(); toast.success("Aviso enviado");}} className="w-full bg-primary text-white py-8 rounded-[40px] text-2xl font-black shadow-xl flex items-center justify-center gap-4 active:scale-95 transition"> <Heart fill="white" size={30}/> ¡Estoy bien! </button> <button onClick={()=>go("emergency")} className="w-full bg-[#E5484D] text-white py-8 rounded-[40px] text-3xl font-black shadow-xl tracking-tighter">EMERGENCIA</button> </div> ); }
function FamilySeniorView({ location, messages, back }: any) { return ( <div className="h-full flex flex-col bg-[#F8F9FA]"> <div className="p-6 flex items-center gap-4 bg-white border-b shadow-sm"><button onClick={back} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft/></button><h1 className="text-2xl font-black italic">Mi Familia</h1></div> <div className="p-6 flex-1 overflow-y-auto space-y-6"> <div className="bg-white p-6 rounded-[45px] shadow-sm text-center"> <MapPin size={40} className="text-primary mx-auto mb-2 animate-bounce" /> <h2 className="text-xl font-black mb-4 leading-tight">Tu ubicación</h2> {location ? <MapView lat={location.lat} lng={location.lng} /> : <p className="text-slate-400 font-bold animate-pulse">Buscando GPS...</p>} </div> <div className="space-y-4"> <h3 className="text-xs font-black text-slate-400 uppercase ml-4 tracking-widest">Mensajes recibidos</h3> {messages.filter((m:any)=>m.text!=='ESTOY_BIEN_SIGNAL').map((m:any,i:number)=>( <div key={i} className="bg-white p-6 rounded-[35px] shadow-sm border relative overflow-hidden"> <span className="text-[9px] font-black bg-primary text-white px-3 py-1 rounded-br-2xl absolute top-0 left-0 uppercase">{m.sender_name}</span> <p className="text-xl font-bold italic text-slate-700 mt-4 leading-tight">"{m.text}"</p> </div> ))} </div> </div> </div> ); }
function VideoCallsView({ fName, fPhone, back }: any) { return ( <div className="h-full flex flex-col bg-[#F8F9FA]"><div className="p-6 flex items-center gap-4 bg-white border-b shadow-sm"><button onClick={back} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft/></button><h1 className="text-2xl font-black italic">Llamar</h1></div><div className="p-6 space-y-4"><button onClick={() => fPhone && (window.location.href = `tel:${fPhone}`)} className="w-full bg-white p-8 rounded-[35px] flex items-center justify-between shadow-sm border active:scale-95 transition"><div><p className="font-black text-2xl text-slate-800 tracking-tighter">{fName || "Familia"}</p><p className="text-slate-400 font-bold text-sm mt-1">{fPhone || "Sin número"}</p></div><div className="bg-green-100 p-4 rounded-full text-green-600"><Phone fill="currentColor" size={24}/></div></button></div></div> ); }
function Profile({ name, code, phone, onLogout, back }: any) { return ( <div className="h-full flex flex-col bg-white p-6 justify-between"><div><div className="flex items-center gap-4 mb-10"><button onClick={back} className="p-3 bg-slate-100 rounded-2xl"><ArrowLeft/></button><h1 className="text-2xl font-black italic">Perfil</h1></div><div className="bg-slate-50 p-10 rounded-[45px] text-center border-2 border-slate-100 shadow-inner"><h2 className="text-4xl font-black text-primary mb-2 tracking-tighter">{name}</h2><p className="font-black text-slate-800 mb-4">{phone}</p><p className="font-black text-slate-400 uppercase text-xs tracking-widest">PIN: {code}</p></div></div><button onClick={onLogout} className="w-full bg-red-50 text-red-500 py-7 rounded-[35px] font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition"><LogOut/> SALIR</button></div> ); }
function NavBtn({ icon, label, onClick }: any) { return ( <button onClick={onClick} className="bg-white p-8 rounded-[40px] flex flex-col items-center gap-4 shadow-sm border border-gray-50 active:scale-95 transition">{icon}<span className="font-black text-xl tracking-tighter">{label}</span></button> ); }
function TasksListView({ tasks, onToggle, back }: any) { return ( <div className="h-full flex flex-col bg-[#F8F9FA]"><div className="p-6 flex items-center gap-4 bg-white border-b shadow-sm"><button onClick={back} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft/></button><h1 className="text-2xl font-black italic">Tareas</h1></div><div className="p-6 space-y-4 overflow-y-auto">{tasks.map((t:any)=>(<button key={t.id} onClick={()=>{onToggle(t.id, t.completed); toast.success("Actualizado");}} className={`w-full p-6 rounded-[35px] flex items-center justify-between border transition ${t.completed ? 'bg-green-50 opacity-60' : 'bg-white'}`}> <div className="flex flex-col items-start text-left"> {t.task_time && <span className="text-[10px] font-black text-primary bg-blue-50 px-2 py-0.5 rounded-lg mb-1">{t.task_time}</span>} <span className={`text-xl font-bold ${t.completed ? 'line-through text-green-800' : 'text-slate-700'}`}>{t.title}</span> </div> {t.completed ? <CheckCircle2 className="text-green-500" size={28}/> : <Circle className="text-slate-200" size={28}/>}</button>))}</div></div> ); }
function NameAndPhoneStep({ title, onNext }: any) { const [n, setN] = useState(""); const [p, setP] = useState(""); return ( <div className="p-8 flex flex-col h-full bg-white"><h1 className="text-4xl font-black mt-20 leading-tight tracking-tighter">{title}</h1><input className="mt-12 w-full p-4 border-b-8 border-primary text-4xl font-black outline-none" value={n} onChange={e=>setN(e.target.value)} placeholder="Nombre" /><input type="tel" className="mt-8 w-full p-4 border-b-8 border-[#1EA851] text-4xl font-black outline-none" value={p} onChange={e=>setP(e.target.value)} placeholder="Teléfono" /><button onClick={() => { if(n&&p) onNext(n, p); else toast.error("Rellena ambos") }} className="mt-auto w-full bg-primary text-white py-6 rounded-[35px] font-black text-2xl shadow-xl">CONTINUAR</button></div> ); }
function Emergency({ cancel }: any) { return ( <div className="h-full bg-[#E5484D] flex flex-col items-center justify-center p-10 text-white text-center"><AlertTriangle size={120} className="mb-6 opacity-40 animate-pulse" /><h1 className="text-[120px] font-black leading-none mb-6 tracking-tighter">112</h1><button onClick={cancel} className="w-full bg-white text-[#E5484D] py-8 rounded-[40px] text-3xl font-black shadow-2xl active:scale-95 transition">CANCELAR</button></div> ); }