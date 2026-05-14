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

  const [screen, setScreen] = useState<Screen>(() => {
    const isLogged = localStorage.getItem("is_logged");
    const role = localStorage.getItem("user_role");
    const name = localStorage.getItem("user_name");
    const fName = localStorage.getItem("family_name");
    if (isLogged === "true") {
      if (role === "family" && fName) return "family_admin";
      if (role === "senior" && name) return "home";
    }
    return "login";
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

  const startTracking = useCallback(() => {
    if (role === "senior" && seniorCode) {
      const saveLoc = async (lat: number, lng: number) => {
        await supabase.from('locations').upsert([{ pin: seniorCode, lat, lng, updated_at: new Date().toISOString() }]);
      };
      navigator.geolocation.watchPosition(
        (pos) => saveLoc(pos.coords.latitude, pos.coords.longitude),
        () => saveLoc(40.4168, -3.7038),
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

  // --- ESCUCHA DE EVENTOS PARA NOTIFICACIONES DEL FAMILIAR ---
  useEffect(() => {
    if (['login', 'name_step', 'f_name_step'].includes(screen)) return;
    fetchData();
    const sub = supabase.channel('api')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        fetchData();
        // Si somos el familiar y la tarea se ha completado, avisamos
        if (role === 'family' && payload.new.completed) {
          toast.success(`¡${name || 'El abuelo/a'} ha completado: ${payload.new.title}!`);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        fetchData();
        // Si somos el familiar y llega un mensaje nuevo (ya sea "Estoy bien" o texto normal)
        if (role === 'family') {
          if (payload.new.text === 'ESTOY_BIEN_SIGNAL') {
             toast.success(`¡${name || 'El abuelo/a'} acaba de avisar que está bien!`, { icon: <Heart fill="#22C55E" className="text-green-500"/> });
          } else if (payload.new.sender_name === name) {
             toast("Nuevo mensaje", { description: `"${payload.new.text}"` });
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => fetchData())
      .subscribe();
      
    return () => { supabase.removeChannel(sub); };
  }, [fetchData, screen, role, name]);

  return (
    <div className="h-screen bg-[#F8F9FA] flex justify-center font-sans overflow-hidden text-slate-800">
      <Toaster position="top-center" />
      <main className="w-full max-w-md bg-[#F8F9FA] relative h-full flex flex-col shadow-2xl overflow-hidden">
        
        {showLocationPrompt && (
          <div className="absolute inset-0 z-[100] bg-black/60 flex items-center justify-center p-6">
            <div className="bg-white rounded-[30px] p-6 w-full shadow-2xl text-center">
              <MapPin size={32} className="text-primary mx-auto mb-3 animate-bounce" />
              <h2 className="text-xl font-black mb-2 leading-tight">¿Compartir ubicación?</h2>
              <p className="text-slate-500 text-sm font-bold mb-6 px-2">Tu familia podrá saber dónde estás para cuidarte mejor.</p>
              <button onClick={() => { localStorage.setItem("location_accepted", "true"); setShowLocationPrompt(false); startTracking(); }} className="w-full bg-primary text-white py-4 rounded-2xl font-black text-lg">SÍ, COMPARTIR</button>
              <button onClick={() => setShowLocationPrompt(false)} className="w-full text-slate-300 font-bold text-sm mt-2">Ahora no</button>
            </div>
          </div>
        )}

        {showSplash ? <SplashScreen /> : (
          <>
            {screen === "login" && <Login onAccess={(r: any, c: any, n?: any, p?: any) => { setRole(r); setSeniorCode(c); localStorage.setItem("is_logged", "true"); localStorage.setItem("user_role", r); localStorage.setItem("senior_code", c); if (r === "family") { if (n) { setFamilyName(n); setScreen("family_admin"); } else setScreen("f_name_step"); } else { if (n) { setName(n); setScreen("home"); } else setScreen("name_step"); } }} />}
            {screen === "name_step" && <NameAndPhoneStep title="¿Cómo te llamas?" onNext={async (n: any, p: any) => { setName(n); localStorage.setItem("user_name", n); await supabase.from('family_pins').update({ senior_name: n, senior_phone: p }).eq('pin', seniorCode); setScreen("home"); }} />}
            {screen === "f_name_step" && <NameAndPhoneStep title="¿Quién eres?" onNext={async (n: any, p: any) => { setFamilyName(n); localStorage.setItem("family_name", n); await supabase.from('family_pins').update({ family_name: n, family_phone: p }).eq('pin', seniorCode); setScreen("family_admin"); }} />}
            {screen === "home" && <Home name={name} latestTask={dbTasks[0]} onWellness={async () => { await supabase.from('messages').insert([{ text: 'ESTOY_BIEN_SIGNAL', sender_name: name, pin: seniorCode }]); toast.success("Aviso enviado a tu familia"); }} go={setScreen} />}
            {screen === "tasks" && <TasksListView tasks={dbTasks} onToggle={(id:any, s:any)=>supabase.from('tasks').update({completed:!s}).eq('id',id)} back={() => setScreen("home")} />}
            {screen === "family" && <FamilySeniorView location={seniorLocation} messages={dbMessages} seniorName={name} seniorCode={seniorCode} back={() => setScreen("home")} />}
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

/* --- SPLASH SCREEN --- */
function SplashScreen() {
  return (
    <div className="h-full bg-primary flex flex-col items-center justify-center p-8 text-white relative z-50">
      <div className="absolute top-[-5%] left-[-5%] w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="relative w-full max-w-[240px] aspect-[4/3] mb-10">
        <img src="/foto1.jpg" alt="Portada" className="w-full h-full object-cover rounded-[35px] border-4 border-white/20 shadow-2xl" />
        <div className="absolute -bottom-3 -right-3 bg-white p-3 rounded-full shadow-xl">
          <Heart className="text-[#E5484D]" fill="#E5484D" size={24} />
        </div>
      </div>
      <div className="text-center px-4">
        <h1 className="text-[10vw] max-text-4xl font-black tracking-tighter mb-2 leading-none whitespace-nowrap">
          ConectaMayores
        </h1>
        <p className="text-blue-100 font-bold text-lg opacity-90 leading-tight">Tu familia, siempre cerca.</p>
      </div>
      <div className="mt-12 w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
    </div>
  );
}

/* --- HOME --- */
function Home({ name, latestTask, onWellness, go }: any) {
  return (
    <div className="p-5 flex flex-col h-full justify-between overflow-y-auto">
      <h1 className="text-3xl font-black mt-2 italic leading-tight truncate">Hola, <span className="text-primary">{name}</span> 👋</h1>
      <div className="p-4 bg-white rounded-[25px] shadow-sm border border-blue-50 flex flex-col justify-center my-4">
        <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Siguiente tarea:</p>
        <div className="flex items-center gap-2">
          {latestTask?.task_time && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-lg font-black text-xs shrink-0"><Clock size={12}/> {latestTask.task_time}</span>}
          <p className="text-lg font-bold text-slate-700 truncate">{latestTask ? latestTask.title : "¡Todo libre!"}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <NavBtn icon={<ListChecks size={26} className="text-primary"/>} label="Tareas" onClick={()=>go("tasks")}/>
        <NavBtn icon={<PhoneForwarded size={26} className="text-primary"/>} label="Llamar" onClick={()=>go("video")}/>
        <NavBtn icon={<Users size={26} className="text-primary"/>} label="Familia" onClick={()=>go("family")}/>
        <NavBtn icon={<UserIcon size={26} className="text-primary"/>} label="Perfil" onClick={()=>go("profile")}/>
      </div>
      <div className="space-y-3">
        <button onClick={onWellness} className="w-full bg-primary text-white py-4 rounded-[20px] text-xl font-black shadow-lg flex items-center justify-center gap-3 active:scale-95 transition">
          <Heart fill="white" size={22}/> ¡Estoy bien!
        </button>
        <button onClick={()=>go("emergency")} className="w-full bg-[#E5484D] text-white py-4 rounded-[20px] text-2xl font-black shadow-lg">EMERGENCIA</button>
      </div>
    </div>
  );
}

function NavBtn({ icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className="bg-white p-4 rounded-[25px] flex flex-col items-center gap-2 shadow-sm border border-gray-50 active:scale-95 transition">
      {icon}
      <span className="font-black text-sm tracking-tighter">{label}</span>
    </button>
  );
}

/* --- PANEL FAMILIAR --- */
function FamilyAdmin({ fName, seniorName, sPhone, location, lastWellness, seniorCode, onLogout }: any) {
  const [taskIn, setTaskIn] = useState(""); const [timeIn, setTimeIn] = useState(""); const [msgIn, setMsgIn] = useState("");
  const addTask = async () => { if(!taskIn) return; await supabase.from('tasks').insert([{ title: taskIn, task_time: timeIn, completed: false, pin: seniorCode }]); setTaskIn(""); setTimeIn(""); toast.success("Tarea enviada"); };
  const sendMsg = async () => { if(!msgIn) return; await supabase.from('messages').insert([{ text: msgIn, sender_name: fName, pin: seniorCode }]); setMsgIn(""); toast.success("Mensaje enviado"); };
  return (
    <div className="h-full flex flex-col p-4 bg-[#F8F9FA] overflow-y-auto pb-10">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm mb-4">
        <div><p className="text-[9px] font-black text-slate-400 uppercase">Bienvenido</p><h1 className="text-lg font-black text-primary italic truncate max-w-[140px]">{fName}</h1></div>
        <button onClick={onLogout} className="p-2 bg-red-50 text-red-500 rounded-lg"><LogOut size={18}/></button>
      </div>
      <div className="bg-white p-4 rounded-[25px] shadow-sm mb-3 border">
        <p className="text-[9px] font-black text-primary uppercase mb-2 tracking-widest">Ubicación de {seniorName || "Abuelo/a"}</p>
        {location ? <MapView lat={location.lat} lng={location.lng} /> : <div className="p-6 bg-slate-50 rounded-xl text-center text-slate-400 font-bold text-xs animate-pulse">Buscando GPS...</div>}
      </div>
      <button onClick={() => sPhone && (window.location.href = `tel:${sPhone}`)} className="w-full bg-[#1EA851] text-white p-4 rounded-[18px] font-black text-lg flex items-center justify-center gap-2 mb-4 shadow-md transition active:scale-95"><Phone fill="white" size={20}/> LLAMAR</button>
      <div className="bg-white p-4 rounded-xl border border-green-50 mb-4 flex justify-between items-center">
        <p className="text-sm font-black truncate">{lastWellness ? `Aviso: ${lastWellness}` : "Sin avisos"}</p>
        <Heart fill={lastWellness ? "#22C55E" : "#CBD5E1"} size={18} className={lastWellness ? "text-green-500" : "text-slate-300"}/>
      </div>
      <div className="bg-white p-4 rounded-xl border mb-3">
        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Asignar Tarea</p>
        <div className="flex gap-2 mb-2">
          <input type="time" className="p-2 bg-blue-50 rounded-lg font-black text-primary text-xs outline-none" value={timeIn} onChange={e=>setTimeIn(e.target.value)} />
          <input className="flex-1 p-2 bg-slate-50 rounded-lg font-bold text-sm outline-none" value={taskIn} onChange={e=>setTaskIn(e.target.value)} placeholder="Tarea..."/>
        </div>
        <button onClick={addTask} className="w-full bg-primary text-white p-2 rounded-lg font-black text-sm">AÑADIR</button>
      </div>
      <div className="bg-white p-4 rounded-xl border">
        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Mensaje</p>
        <div className="flex gap-2">
          <input className="flex-1 p-2 bg-slate-50 rounded-lg font-bold text-sm outline-none" value={msgIn} onChange={e=>setMsgIn(e.target.value)} placeholder="Dile algo..."/>
          <button onClick={sendMsg} className="bg-primary text-white p-2 rounded-lg shadow-md"><Send size={16}/></button>
        </div>
      </div>
    </div>
  );
}

/* --- VISTA FAMILIA SENIOR CON OPCIÓN DE RESPUESTA --- */
function FamilySeniorView({ location, messages, seniorName, seniorCode, back }: any) { 
  const [replyMsg, setReplyMsg] = useState("");
  const sendReply = async () => {
    if(!replyMsg) return;
    await supabase.from('messages').insert([{ text: replyMsg, sender_name: seniorName, pin: seniorCode }]);
    setReplyMsg("");
    toast.success("Mensaje enviado a tu familia");
  };

  return ( 
    <div className="h-full flex flex-col bg-[#F8F9FA]"> 
      <div className="p-4 flex items-center gap-3 bg-white border-b"><button onClick={back} className="p-2 bg-gray-100 rounded-lg"><ArrowLeft size={18}/></button><h1 className="text-xl font-black italic">Familia</h1></div> 
      <div className="p-4 flex-1 overflow-y-auto space-y-4"> 
        <div className="bg-white p-4 rounded-3xl shadow-sm text-center"> 
          <MapPin size={28} className="text-primary mx-auto mb-2 animate-bounce" /> 
          <h2 className="text-lg font-black mb-3 leading-tight">Ubicación</h2> 
          {location ? <MapView lat={location.lat} lng={location.lng} /> : <p className="text-slate-400 text-xs">Buscando GPS...</p>} 
        </div> 

        {/* Novedad: Enviar mensaje a la familia */}
        <div className="bg-white p-4 rounded-xl border">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Escribir a familia</p>
          <div className="flex gap-2">
            <input className="flex-1 p-2 bg-slate-50 rounded-lg font-bold text-sm outline-none" value={replyMsg} onChange={e=>setReplyMsg(e.target.value)} placeholder="Diles cómo estás..."/>
            <button onClick={sendReply} className="bg-primary text-white p-2 rounded-lg shadow-md"><Send size={16}/></button>
          </div>
        </div>

        <div className="space-y-3"> 
          <h3 className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Conversación</h3> 
          {messages.filter((m:any)=>m.text!=='ESTOY_BIEN_SIGNAL').map((m:any,i:number)=>( 
            <div key={i} className={`p-4 rounded-xl shadow-sm border relative overflow-hidden ${m.sender_name === seniorName ? 'bg-blue-50 ml-6' : 'bg-white mr-6'}`}> 
              <span className={`text-[8px] font-black text-white px-2 py-0.5 absolute top-0 uppercase ${m.sender_name === seniorName ? 'bg-blue-400 rounded-bl-lg right-0' : 'bg-primary rounded-br-lg left-0'}`}>{m.sender_name === seniorName ? 'Tú' : m.sender_name}</span> 
              <p className="text-lg font-bold italic text-slate-700 mt-2 leading-tight">"{m.text}"</p> 
            </div> 
          ))} 
        </div> 
      </div> 
    </div> 
  ); 
}

/* --- MAPA Y OTRAS VISTAS (SIN CAMBIOS) --- */
function MapView({ lat, lng }: any) { const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.005},${lat-0.005},${lng+0.005},${lat+0.005}&layer=mapnik&marker=${lat},${lng}`; return ( <div className="w-full h-36 rounded-xl overflow-hidden border relative"> <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={mapUrl} style={{ border: 0 }} /> </div> ); }
function Login({ onAccess }: any) { const [view, setView] = useState<any>("choice"); const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [code, setCode] = useState(""); const [regN, setRegN] = useState(""); const [regP, setRegP] = useState(""); const handleF = async (m:any) => { const { error } = m === 'reg' ? await supabase.auth.signUp({ email, password: pass }) : await supabase.auth.signInWithPassword({ email, password: pass }); if (error) return toast.error(error.message); if (m === 'reg') await supabase.from('family_pins').upsert([{ pin: code, family_name: regN, family_phone: regP }]); const { data: pD } = await supabase.from('family_pins').select('*').eq('pin', code).single(); onAccess("family", code, pD?.family_name, pD?.family_phone); }; return ( <div className="p-6 flex flex-col h-full bg-white items-center justify-center animate-in fade-in duration-500"> <div className="mb-4 bg-primary p-4 rounded-3xl shadow-lg"><Heart fill="white" className="text-white w-10 h-10" /></div> <h1 className="text-3xl font-black mb-8 tracking-tighter leading-tight text-center px-4">ConectaMayores</h1> {view === "choice" && <div className="w-full space-y-3"><button onClick={() => setView("s_code")} className="w-full bg-primary text-white p-6 rounded-[25px] text-2xl font-black shadow-md">Soy Abuela/o</button><div className="flex gap-2"><button onClick={() => setView("f_login")} className="flex-1 bg-white text-slate-600 p-4 rounded-xl font-bold border">Entrar</button><button onClick={() => setView("f_reg")} className="flex-1 bg-slate-50 text-primary p-4 rounded-xl font-bold border">Registrar</button></div></div>} {view === "s_code" && <div className="w-full space-y-6"><h2 className="text-xl font-black text-center">Introduce PIN</h2><input type="number" className="w-full p-6 bg-slate-50 rounded-2xl text-5xl font-black text-center outline-none" value={code} onChange={e => setCode(e.target.value)} /><button onClick={async () => { const { data } = await supabase.from('family_pins').select('*').eq('pin', code).single(); if (data) onAccess("senior", code, data.senior_name, data.senior_phone); else toast.error("PIN no válido"); }} className="w-full bg-[#1EA851] text-white p-5 rounded-2xl text-xl font-black">ENTRAR</button><button onClick={() => setView("choice")} className="w-full text-slate-400 font-bold text-xs">Volver</button></div>} {view === "f_login" && <div className="w-full space-y-3"><input className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><input className="w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none" type="password" placeholder="Pass" value={pass} onChange={e => setPass(e.target.value)} /><input className="w-full p-3 bg-blue-50 border rounded-xl font-bold outline-none" placeholder="PIN" value={code} onChange={e => setCode(e.target.value)} /><button onClick={()=>handleF('log')} className="w-full bg-primary text-white p-3 rounded-xl font-black">ENTRAR</button><button onClick={() => setView("choice")} className="w-full text-slate-400 font-bold mt-2 text-xs">Volver</button></div>} {view === "f_reg" && <div className="w-full space-y-2"><input className="w-full p-2 bg-slate-50 border rounded-lg text-sm" placeholder="Nombre" value={regN} onChange={e => setRegN(e.target.value)} /><input className="w-full p-2 bg-slate-50 border rounded-lg text-sm" placeholder="Tel" value={regP} onChange={e => setRegP(e.target.value)} /><input className="w-full p-2 bg-slate-50 border rounded-lg text-sm" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><input className="w-full p-2 bg-slate-50 border rounded-lg text-sm" type="password" placeholder="Pass" value={pass} onChange={e => setPass(e.target.value)} /><input className="w-full p-2 bg-blue-50 border rounded-lg text-sm" placeholder="PIN" value={code} onChange={e => setCode(e.target.value)} /><button onClick={()=>handleF('reg')} className="w-full bg-[#1EA851] text-white p-3 rounded-xl font-black mt-2">REGISTRAR</button></div>} </div> ); }
function TasksListView({ tasks, onToggle, back }: any) { return ( <div className="h-full flex flex-col bg-[#F8F9FA]"><div className="p-4 flex items-center gap-3 bg-white border-b shadow-sm"><button onClick={back} className="p-2 bg-gray-100 rounded-lg"><ArrowLeft size={18}/></button><h1 className="text-xl font-black italic">Tareas</h1></div><div className="p-4 space-y-3 overflow-y-auto">{tasks.map((t:any)=>(<button key={t.id} onClick={()=>{onToggle(t.id, t.completed);}} className={`w-full p-4 rounded-xl flex items-center justify-between border transition ${t.completed ? 'bg-green-50 opacity-60' : 'bg-white'}`}> <div className="flex flex-col items-start text-left"> {t.task_time && <span className="text-[8px] font-black text-primary bg-blue-50 px-2 rounded-lg">{t.task_time}</span>} <span className={`text-base font-bold ${t.completed ? 'line-through text-green-800' : 'text-slate-700'}`}>{t.title}</span> </div> {t.completed ? <CheckCircle2 className="text-green-500" size={22}/> : <Circle className="text-slate-200" size={22}/>}</button>))}</div></div> ); }
function NameAndPhoneStep({ title, onNext }: any) { const [n, setN] = useState(""); const [p, setP] = useState(""); return ( <div className="p-8 flex flex-col h-full bg-white"><h1 className="text-3xl font-black mt-10 leading-tight tracking-tighter">{title}</h1><input className="mt-8 w-full p-3 border-b-4 border-primary text-2xl font-black outline-none placeholder:text-slate-100" value={n} onChange={e=>setN(e.target.value)} placeholder="Nombre" /><input type="tel" className="mt-4 w-full p-3 border-b-4 border-[#1EA851] text-2xl font-black outline-none placeholder:text-slate-100" value={p} onChange={e=>setP(e.target.value)} placeholder="Teléfono" /><button onClick={() => { if(n&&p) onNext(n, p); else toast.error("Rellena ambos") }} className="mt-auto w-full bg-primary text-white py-4 rounded-xl font-black text-lg shadow-lg">CONTINUAR</button></div> ); }
function Emergency({ cancel }: any) { return ( <div className="h-full bg-[#E5484D] flex flex-col items-center justify-center p-8 text-white text-center"><AlertTriangle size={80} className="mb-4 opacity-40 animate-pulse" /><h1 className="text-7xl font-black leading-none mb-8 tracking-tighter">112</h1><button onClick={cancel} className="w-full bg-white text-[#E5484D] py-5 rounded-2xl text-2xl font-black shadow-xl transition active:scale-95">CANCELAR</button></div> ); }
function VideoCallsView({ fName, fPhone, back }: any) { return ( <div className="h-full flex flex-col bg-[#F8F9FA]"><div className="p-4 flex items-center gap-3 bg-white border-b"><button onClick={back} className="p-2 bg-gray-100 rounded-lg"><ArrowLeft size={18}/></button><h1 className="text-xl font-black italic">Llamar</h1></div><div className="p-4 space-y-3"><button onClick={() => fPhone && (window.location.href = `tel:${fPhone}`)} className="w-full bg-white p-6 rounded-2xl flex items-center justify-between shadow-sm border active:scale-95 transition"><div><p className="font-black text-lg text-slate-800 leading-none">{fName || "Familia"}</p><p className="text-slate-400 font-bold text-xs mt-1">{fPhone || "Sin número"}</p></div><div className="bg-green-100 p-3 rounded-full text-green-600"><Phone fill="currentColor" size={20}/></div></button></div></div> ); }
function Profile({ name, code, phone, onLogout, back }: any) { return ( <div className="h-full flex flex-col bg-white p-5 justify-between"><div><div className="flex items-center gap-3 mb-6"><button onClick={back} className="p-2 bg-slate-100 rounded-lg"><ArrowLeft size={18}/></button><h1 className="text-xl font-black italic">Perfil</h1></div><div className="bg-slate-50 p-6 rounded-[30px] text-center border shadow-inner"><h2 className="text-3xl font-black text-primary mb-1 truncate">{name}</h2><p className="font-black text-slate-800 text-sm mb-3">{phone}</p><p className="font-black text-slate-300 uppercase text-[9px] tracking-widest">PIN: {code}</p></div></div><button onClick={onLogout} className="w-full bg-red-50 text-red-500 py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition"><LogOut size={18}/> SALIR</button></div> ); }