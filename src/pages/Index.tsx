import { useEffect, useState, useCallback } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from '../supabaseClient';
import {
  ArrowLeft, Heart, ListChecks, Users, User as UserIcon, 
  Send, LogOut, Phone, PhoneForwarded, CheckCircle2, Circle, AlertTriangle, Clock, MapPin, Check
} from "lucide-react";

type Screen = "login" | "name_step" | "home" | "family_home" | "tasks" | "video" | "chat" | "emergency" | "profile";
type Task = { id: string; title: string; completed: boolean; task_time?: string; pin: string };
type Message = { text: string; sender_name: string; created_at: string; pin: string };
type Location = { lat: number; lng: number; updated_at: string };

export default function Index() {
  const [showSplash, setShowSplash] = useState(true);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  const [screen, setScreen] = useState<Screen>(() => {
    const isLogged = localStorage.getItem("is_logged");
    const role = localStorage.getItem("user_role");
    const storedName = localStorage.getItem("user_name");
    if (isLogged === "true") {
      if (role === "family") return "family_home";
      if (role === "senior") return storedName ? "home" : "name_step";
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
    const timer = setTimeout(() => setShowSplash(false), 4000);
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
      if (pD.senior_name) {
        setName(pD.senior_name);
        localStorage.setItem("user_name", pD.senior_name);
        setScreen(prev => prev === "name_step" ? "home" : prev);
      }
      if (pD.senior_phone) setSeniorPhone(pD.senior_phone);
      if (pD.family_phone) setFamilyPhone(pD.family_phone);
    }
    const { data: tk } = await supabase.from('tasks').select('*').eq('pin', seniorCode).order('created_at', { ascending: false });
    if (tk) setDbTasks(tk);
    const { data: ms } = await supabase.from('messages').select('*').eq('pin', seniorCode).order('created_at', { ascending: false }).limit(30);
    if (ms) setDbMessages(ms);
    const { data: wl } = await supabase.from('messages').select('created_at').eq('text', 'ESTOY_BIEN_SIGNAL').eq('pin', seniorCode).order('created_at', { ascending: false }).limit(1);
    if (wl?.[0]) setLastWellness(new Date(wl[0].created_at).toLocaleTimeString());
    const { data: lc } = await supabase.from('locations').select('*').eq('pin', seniorCode).single();
    if (lc) setSeniorLocation(lc);
  }, [seniorCode]);

  useEffect(() => {
    if (['login'].includes(screen)) return;
    fetchData();
    const sub = supabase.channel('api').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchData, screen]);

  const handleAccess = (r: any, c: any, n?: any) => {
    setRole(r); setSeniorCode(c);
    localStorage.setItem("is_logged", "true");
    localStorage.setItem("user_role", r);
    localStorage.setItem("senior_code", c);
    if (r === "family") {
      setScreen("family_home");
    } else {
      if (n && n.trim() !== "") { setName(n); localStorage.setItem("user_name", n); setScreen("home"); } 
      else setScreen("name_step");
    }
  };

  const handleLogout = () => { localStorage.clear(); window.location.reload(); };

  const toggleTask = async (id: string, currentStatus: boolean) => {
    setDbTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
    await supabase.from('tasks').update({completed: !currentStatus}).eq('id', id);
  };

  const addTask = async (title: string, time: string) => {
    if(!title) return;
    await supabase.from('tasks').insert([{ title, task_time: time, completed: false, pin: seniorCode }]);
    toast.success("Tarea asignada");
  };

  return (
    <div className="h-screen bg-[#F8F9FA] flex justify-center font-sans overflow-hidden text-slate-800">
      <Toaster position="top-center" />
      <main className="w-full max-w-md bg-[#F8F9FA] relative h-full flex flex-col shadow-2xl overflow-hidden">
        
        {showLocationPrompt && (
          <div className="absolute inset-0 z-[100] bg-black/60 flex items-center justify-center p-6">
            <div className="bg-white rounded-[30px] p-6 w-full shadow-2xl text-center">
              <MapPin size={32} className="text-primary mx-auto mb-3 animate-bounce" />
              <h2 className="text-xl font-black mb-2">¿Compartir ubicación?</h2>
              <p className="text-slate-500 text-sm font-bold mb-6 px-2">Tu familia podrá cuidarte mejor si saben dónde estás.</p>
              <button onClick={() => { localStorage.setItem("location_accepted", "true"); setShowLocationPrompt(false); startTracking(); }} className="w-full bg-primary text-white py-4 rounded-2xl font-black text-lg">SÍ, COMPARTIR</button>
            </div>
          </div>
        )}

        {showSplash ? <SplashScreen /> : (
          <>
            {screen === "login" && <Login onAccess={handleAccess} />}
            {screen === "name_step" && <NameAndPhoneStep title="¿Cómo te llamas?" onNext={async (n: any, p: any) => { setName(n); localStorage.setItem("user_name", n); await supabase.from('family_pins').update({ senior_name: n, senior_phone: p }).eq('pin', seniorCode); setScreen("home"); }} />}
            
            {/* MENÚS PRINCIPALES (BLOQUES) */}
            {screen === "home" && <SeniorHome name={name} latestTask={dbTasks.find(t=>!t.completed)} onWellness={async () => { await supabase.from('messages').insert([{ text: 'ESTOY_BIEN_SIGNAL', sender_name: name, pin: seniorCode }]); toast.success("Aviso enviado"); }} go={setScreen} />}
            {screen === "family_home" && <FamilyHome fName={familyName} seniorName={name} location={seniorLocation} lastWellness={lastWellness} go={setScreen} onLogout={handleLogout} />}

            {/* PANTALLAS COMPARTIDAS */}
            {screen === "tasks" && <TasksView tasks={dbTasks} role={role} onToggle={toggleTask} onAdd={addTask} back={() => setScreen(role === "family" ? "family_home" : "home")} />}
            {screen === "chat" && <ChatView messages={dbMessages} myName={role === 'family' ? familyName : name} pin={seniorCode} back={() => setScreen(role === "family" ? "family_home" : "home")} />}
            {screen === "video" && <VideoCallsView role={role} fPhone={familyPhone} seniorName={name} sPhone={seniorPhone} back={() => setScreen(role === "family" ? "family_home" : "home")} />}
            {screen === "profile" && <Profile name={role === 'family' ? familyName : name} code={seniorCode} phone={role === 'family' ? '' : seniorPhone} onLogout={handleLogout} back={() => setScreen(role === "family" ? "family_home" : "home")} />}
            
            {screen === "emergency" && <Emergency cancel={() => setScreen("home")} />}
          </>
        )}
      </main>
    </div>
  );
}

/* --- MENÚ ABUELA --- */
function SeniorHome({ name, latestTask, onWellness, go }: any) {
  return (
    <div className="p-4 flex flex-col h-full justify-between overflow-y-auto">
      <h1 className="text-3xl font-black mt-2 italic truncate px-2 leading-none">Hola, <span className="text-primary">{name}</span> 👋</h1>
      <div className="p-4 bg-white rounded-3xl shadow-sm border border-blue-50 flex flex-col justify-center my-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Siguiente tarea:</p>
        <div className="flex items-center gap-2">
          {latestTask?.task_time && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-lg font-black text-xs shrink-0"><Clock size={12}/> {latestTask.task_time}</span>}
          <p className="text-lg font-bold text-slate-700 truncate">{latestTask ? latestTask.title : "¡Sin tareas pendientes!"}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <NavBtn icon={<ListChecks size={28} className="text-primary"/>} label="Tareas" onClick={()=>go("tasks")}/>
        <NavBtn icon={<PhoneForwarded size={28} className="text-primary"/>} label="Llamar" onClick={()=>go("video")}/>
        <NavBtn icon={<Users size={28} className="text-primary"/>} label="Familia" onClick={()=>go("chat")}/>
        <NavBtn icon={<UserIcon size={28} className="text-primary"/>} label="Perfil" onClick={()=>go("profile")}/>
      </div>
      <div className="space-y-3">
        <button onClick={onWellness} className="w-full bg-primary text-white py-5 rounded-[20px] text-xl font-black shadow-xl flex items-center justify-center gap-3 active:scale-95 transition">
          <Heart fill="white" size={24}/> ¡Estoy bien!
        </button>
        <button onClick={()=>go("emergency")} className="w-full bg-[#E5484D] text-white py-5 rounded-[20px] text-2xl font-black shadow-xl uppercase">Emergencia</button>
      </div>
    </div>
  );
}

/* --- NUEVO: MENÚ FAMILIAR (IGUAL AL DE LA ABUELA) --- */
function FamilyHome({ fName, seniorName, location, lastWellness, go, onLogout }: any) {
  return (
    <div className="p-4 flex flex-col h-full overflow-y-auto pb-6 bg-[#F8F9FA]">
      <div className="flex justify-between items-center mb-6 mt-2 px-2">
        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bienvenido</p><h1 className="text-3xl font-black text-primary italic leading-none truncate max-w-[200px]">{fName}</h1></div>
        <button onClick={onLogout} className="p-3 bg-red-50 text-red-500 rounded-2xl active:scale-90 transition"><LogOut size={20}/></button>
      </div>

      <div className="bg-white p-4 rounded-[30px] shadow-sm border border-slate-100 text-center mb-4">
        <MapPin size={28} className="text-primary mx-auto mb-2 animate-bounce" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ubicación de {seniorName || 'Abuela/o'}</p>
        {location ? <MapView lat={location.lat} lng={location.lng} /> : <div className="h-32 bg-slate-50 rounded-2xl flex items-center justify-center text-xs font-bold text-slate-300">Buscando señal GPS...</div>}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-green-50 mb-6 flex justify-between items-center shadow-sm">
        <p className="text-sm font-black italic">{lastWellness ? `Último aviso: ${lastWellness}` : "Sin avisos hoy"}</p>
        <Heart fill={lastWellness ? "#22C55E" : "#CBD5E1"} size={22} className={lastWellness ? "text-green-500" : "text-slate-300"}/>
      </div>

      {/* 4 BOTONES EXACTAMENTE COMO LOS DE LA ABUELA */}
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <NavBtn icon={<ListChecks size={28} className="text-primary"/>} label="Tareas" onClick={()=>go("tasks")}/>
        <NavBtn icon={<PhoneForwarded size={28} className="text-primary"/>} label="Llamar" onClick={()=>go("video")}/>
        <NavBtn icon={<Users size={28} className="text-primary"/>} label="Chat" onClick={()=>go("chat")}/>
        <NavBtn icon={<UserIcon size={28} className="text-primary"/>} label="Perfil" onClick={()=>go("profile")}/>
      </div>
    </div>
  );
}

function NavBtn({ icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className="bg-white p-5 rounded-[25px] flex flex-col items-center gap-2 shadow-sm border border-gray-50 active:scale-95 transition">
      {icon}
      <span className="font-black text-sm tracking-tighter uppercase">{label}</span>
    </button>
  );
}

/* --- VISTA CHAT COMPARTIDA --- */
function ChatView({ messages, myName, pin, back }: any) {
  const [msgIn, setMsgIn] = useState("");
  const sendMsg = async () => {
    if(!msgIn) return;
    await supabase.from('messages').insert([{ text: msgIn, sender_name: myName, pin }]);
    setMsgIn("");
  };

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <div className="p-4 bg-white border-b shadow-sm flex items-center gap-3">
        <button onClick={back} className="p-2 bg-slate-100 rounded-lg"><ArrowLeft size={18}/></button>
        <h1 className="text-xl font-black italic">Chat Familiar</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 flex flex-col-reverse custom-scroll pb-6">
        {messages.filter((m:any)=>m.text!=='ESTOY_BIEN_SIGNAL').map((m:any, i:number) => {
          const isMe = m.sender_name === myName;
          return (
            <div key={i} className={`p-4 rounded-2xl shadow-sm border relative overflow-hidden ${isMe ? 'bg-blue-50 ml-10 border-blue-100' : 'bg-white mr-10 border-slate-200'}`}>
              <span className={`text-[8px] font-black text-white px-2 py-0.5 absolute top-0 uppercase ${isMe ? 'bg-blue-400 right-0 rounded-bl-lg' : 'bg-primary left-0 rounded-br-lg'}`}>
                {isMe ? 'Yo' : m.sender_name}
              </span>
              <p className="text-base font-bold italic text-slate-700 mt-3 leading-tight">"{m.text}"</p>
            </div>
          )
        })}
        {messages.filter((m:any)=>m.text!=='ESTOY_BIEN_SIGNAL').length === 0 && <p className="text-center text-xs text-slate-400 font-bold mt-10">No hay mensajes aún.</p>}
      </div>
      <div className="p-3 bg-white border-t flex gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-10">
        <input className="flex-1 p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none border" value={msgIn} onChange={e=>setMsgIn(e.target.value)} placeholder="Escribe un mensaje..."/>
        <button onClick={sendMsg} className="bg-primary text-white p-3 rounded-xl active:scale-90 transition"><Send size={20}/></button>
      </div>
    </div>
  );
}

/* --- VISTA TAREAS COMPARTIDA (SINCRONIZACIÓN AL INSTANTE) --- */
function TasksView({ tasks, role, onToggle, onAdd, back }: any) {
  const [taskIn, setTaskIn] = useState(""); const [timeIn, setTimeIn] = useState("");
  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <div className="p-4 bg-white border-b shadow-sm flex items-center gap-3">
        <button onClick={back} className="p-2 bg-slate-100 rounded-lg"><ArrowLeft size={18}/></button>
        <h1 className="text-xl font-black italic">Tareas</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-6">
        {tasks.map((t:any)=>(
          <button key={t.id} onClick={()=>onToggle(t.id, t.completed)} className={`w-full p-5 rounded-2xl flex items-center justify-between border shadow-sm transition active:scale-95 ${t.completed ? 'bg-green-50/50 border-green-100' : 'bg-white'}`}> 
            <div className="flex flex-col items-start text-left"> 
              {t.task_time && <span className="text-[10px] font-black text-primary bg-blue-50 px-2 py-0.5 rounded-lg mb-1">{t.task_time}</span>} 
              <span className={`text-lg font-bold leading-tight ${t.completed ? 'line-through text-green-700/60' : 'text-slate-800'}`}>{t.title}</span> 
            </div> 
            {t.completed ? <CheckCircle2 className="text-green-500 shrink-0" size={26}/> : <Circle className="text-slate-300 shrink-0" size={26}/>}
          </button>
        ))}
        {tasks.length === 0 && <p className="text-center text-slate-400 text-sm font-bold mt-10">No hay tareas pendientes.</p>}
      </div>
      {role === 'family' && (
        <div className="p-3 bg-white border-t flex gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-10">
          <input type="time" className="p-3 bg-blue-50 rounded-xl font-black text-primary text-xs outline-none" value={timeIn} onChange={e=>setTimeIn(e.target.value)} />
          <input className="flex-1 p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none border" value={taskIn} onChange={e=>setTaskIn(e.target.value)} placeholder="Añadir tarea..."/>
          <button onClick={() => { onAdd(taskIn, timeIn); setTaskIn(""); setTimeIn(""); }} className="bg-primary text-white p-3 rounded-xl active:scale-90 transition"><Check size={20}/></button>
        </div>
      )}
    </div>
  )
}

/* --- VISTA LLAMADAS MULTI-USUARIO --- */
function VideoCallsView({ role, fPhone, seniorName, sPhone, back }: any) { 
  let contacts: any[] = [];
  if (role === 'senior') {
    try {
      contacts = JSON.parse(fPhone);
      if (!Array.isArray(contacts)) throw new Error();
    } catch(e) {
      if (fPhone && fPhone.trim() !== "") contacts = [{ name: "Familia", phone: fPhone }];
    }
  }

  return ( 
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <div className="p-4 flex items-center gap-3 bg-white border-b shadow-sm">
        <button onClick={back} className="p-2 bg-gray-100 rounded-lg"><ArrowLeft size={18}/></button>
        <h1 className="text-xl font-black italic">Llamar</h1>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        {role === 'family' ? (
           <button onClick={() => sPhone && (window.location.href = `tel:${sPhone}`)} className="w-full bg-[#1EA851] text-white p-6 rounded-3xl flex items-center justify-between shadow-xl active:scale-95 transition">
             <div className="text-left">
               <p className="font-black text-2xl leading-none uppercase">{seniorName || "Abuela/o"}</p>
               <p className="text-green-100 font-bold text-sm mt-2">{sPhone || "Sin número"}</p>
             </div>
             <div className="bg-white/20 p-4 rounded-full"><Phone fill="currentColor" size={28}/></div>
           </button>
        ) : (
          <>
            {contacts.map((c, idx) => (
              <button key={idx} onClick={() => c.phone && (window.location.href = `tel:${c.phone}`)} className="w-full bg-white p-6 rounded-3xl flex items-center justify-between border shadow-sm active:scale-95 transition mb-3">
                <div className="text-left">
                  <p className="font-black text-xl text-slate-800 leading-none uppercase">{c.name}</p>
                  <p className="text-slate-400 font-bold text-sm mt-1">{c.phone}</p>
                </div>
                <div className="bg-green-100 p-4 rounded-full text-green-600"><Phone fill="currentColor" size={24}/></div>
              </button>
            ))}
            {contacts.length === 0 && <p className="text-center text-slate-400 text-sm font-bold mt-10">Ningún familiar ha registrado su teléfono aún.</p>}
          </>
        )}
      </div>
    </div> 
  ); 
}

/* --- LOGIN BLINDADO (ARRAY DE CONTACTOS) --- */
function Login({ onAccess }: any) {
  const [view, setView] = useState<any>("choice");
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [code, setCode] = useState(""); const [regN, setRegN] = useState(""); const [regP, setRegP] = useState("");

  const handleF = async (m:any) => {
    if (!email || !pass || !code) return toast.error("Faltan datos");
    const { error } = m === 'reg' ? await supabase.auth.signUp({ email, password: pass }) : await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return toast.error("Error al entrar. Revisa los datos.");
    
    if (m === 'reg') {
      const { data: exist } = await supabase.from('family_pins').select('*').eq('pin', code).single();
      let newContacts = [];
      if (!exist) {
        newContacts = [{ name: regN, phone: regP }];
        await supabase.from('family_pins').insert([{ pin: code, family_phone: JSON.stringify(newContacts) }]);
      } else {
        try { newContacts = exist.family_phone ? JSON.parse(exist.family_phone) : [{ name: "Familiar", phone: exist.family_phone }]; } catch(e) { newContacts = [{ name: "Familiar", phone: exist.family_phone }]; }
        if (!Array.isArray(newContacts)) newContacts = [];
        newContacts.push({ name: regN, phone: regP });
        await supabase.from('family_pins').update({ family_phone: JSON.stringify(newContacts) }).eq('pin', code);
      }
    }
    const nameToUse = m === 'reg' ? regN : (localStorage.getItem("family_name") || "Familiar");
    localStorage.setItem("family_name", nameToUse);
    onAccess("family", code, nameToUse);
  };

  return (
    <div className="p-6 flex flex-col h-full bg-white items-center justify-center text-center">
      <div className="mb-4 bg-primary p-4 rounded-3xl shadow-lg"><Heart fill="white" className="text-white w-10 h-10" /></div>
      <h1 className="text-4xl font-black mb-10 tracking-tighter leading-none">Conecta<br/>Mayores</h1>
      {view === "choice" && <div className="w-full space-y-3"><button onClick={() => setView("s_code")} className="w-full bg-primary text-white p-6 rounded-[25px] text-2xl font-black uppercase shadow-lg">Soy Abuela/o</button><div className="flex gap-2"><button onClick={() => setView("f_login")} className="flex-1 bg-white text-slate-600 p-4 rounded-xl font-bold border">Entrar</button><button onClick={() => setView("f_reg")} className="flex-1 bg-slate-50 text-primary p-4 rounded-xl font-bold border">Registrar</button></div></div>}
      {view === "s_code" && <div className="w-full space-y-6"><h2 className="text-xl font-black">PIN de Acceso</h2><input type="number" className="w-full p-6 bg-slate-50 rounded-2xl text-5xl font-black text-center outline-none border" value={code} onChange={e => setCode(e.target.value)} /><button onClick={async () => { const { data } = await supabase.from('family_pins').select('*').eq('pin', code).single(); if (data) onAccess("senior", code, data.senior_name); else toast.error("PIN no válido"); }} className="w-full bg-[#1EA851] text-white p-5 rounded-2xl text-xl font-black uppercase">Entrar</button></div>}
      {view === "f_login" && <div className="w-full space-y-3"><input className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><input className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm" type="password" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} /><input className="w-full p-4 bg-blue-50 border rounded-xl font-bold text-sm" placeholder="PIN Familiar" value={code} onChange={e => setCode(e.target.value)} /><button onClick={()=>handleF('log')} className="w-full bg-primary text-white p-4 rounded-xl font-black uppercase mt-2 shadow-md">Entrar</button></div>}
      {view === "f_reg" && <div className="w-full space-y-2"><input className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold" placeholder="Tu Nombre (Ej: Iker)" value={regN} onChange={e => setRegN(e.target.value)} /><input className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold" placeholder="Tu Teléfono" type="tel" value={regP} onChange={e => setRegP(e.target.value)} /><input className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} /><input className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold" type="password" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} /><input className="w-full p-3 bg-blue-50 border rounded-xl text-sm font-bold" placeholder="PIN de la abuela" value={code} onChange={e => setCode(e.target.value)} /><button onClick={()=>handleF('reg')} className="w-full bg-[#1EA851] text-white p-4 rounded-xl font-black uppercase mt-2 shadow-md">Registrar</button></div>}
      {view !== "choice" && <button onClick={() => setView("choice")} className="mt-6 text-slate-300 font-bold text-xs uppercase tracking-widest p-2">Volver al inicio</button>}
    </div>
  );
}

/* --- VISTAS AUXILIARES --- */
function SplashScreen() { return ( <div className="h-full bg-primary flex flex-col items-center justify-center p-8 text-white relative z-50"> <div className="absolute top-[-5%] left-[-5%] w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse"></div> <div className="relative w-full max-w-[180px] aspect-[4/3] mb-6"> <img src="/foto1.jpg" alt="Portada" className="w-full h-full object-cover rounded-[25px] border-4 border-white/20 shadow-2xl" /> <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-xl"><Heart className="text-[#E5484D]" fill="#E5484D" size={18} /></div> </div> <h1 className="text-3xl font-black tracking-tighter mb-1 leading-none text-center">ConectaMayores</h1> <p className="text-blue-100 font-bold text-sm opacity-90 text-center px-4 mt-2">Tu familia, siempre cerca.</p> <div className="mt-8 w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> </div> ); }
function MapView({ lat, lng }: any) { const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.005},${lat-0.005},${lng+0.005},${lat+0.005}&layer=mapnik&marker=${lat},${lng}`; return ( <div className="w-full h-32 rounded-xl overflow-hidden border relative"> <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={mapUrl} style={{ border: 0 }} /> </div> ); }
function NameAndPhoneStep({ title, onNext }: any) { const [n, setN] = useState(""); const [p, setP] = useState(""); return ( <div className="p-8 flex flex-col h-full bg-white"><h1 className="text-3xl font-black mt-10 tracking-tighter leading-none">{title}</h1><input className="mt-8 w-full p-4 border-b-4 border-primary text-2xl font-black outline-none placeholder:text-slate-200" value={n} onChange={e=>setN(e.target.value)} placeholder="Tu Nombre" /><input type="tel" className="mt-6 w-full p-4 border-b-4 border-[#1EA851] text-2xl font-black outline-none placeholder:text-slate-200" value={p} onChange={e=>setP(e.target.value)} placeholder="Tu Teléfono" /><button onClick={() => onNext(n, p)} className="mt-auto w-full bg-primary text-white py-5 rounded-2xl font-black text-xl shadow-lg">CONTINUAR</button></div> ); }
function Emergency({ cancel }: any) { return ( <div className="h-full bg-[#E5484D] flex flex-col items-center justify-center p-8 text-white text-center"><AlertTriangle size={80} className="mb-6 animate-pulse opacity-50" /><h1 className="text-[100px] font-black leading-none mb-10 tracking-tighter uppercase drop-shadow-lg">112</h1><button onClick={cancel} className="w-full bg-white text-[#E5484D] py-6 rounded-3xl text-2xl font-black active:scale-95 transition shadow-2xl">VOLVER</button></div> ); }
function Profile({ name, code, phone, onLogout, back }: any) { return ( <div className="h-full flex flex-col bg-white p-5 justify-between"><div><div className="flex items-center gap-3 mb-6"><button onClick={back} className="p-2 bg-slate-100 rounded-lg"><ArrowLeft size={18}/></button><h1 className="text-xl font-black italic leading-none">Perfil</h1></div><div className="bg-slate-50 p-8 rounded-[30px] text-center border shadow-inner"><h2 className="text-3xl font-black text-primary mb-2 truncate leading-none">{name}</h2><p className="font-black text-slate-500 text-base mb-6">{phone}</p><div className="bg-white p-4 rounded-xl shadow-sm inline-block"><p className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-1">PIN DE CONEXIÓN</p><p className="text-2xl font-black tracking-widest text-slate-800">{code}</p></div></div></div><button onClick={onLogout} className="w-full bg-red-50 text-red-500 py-5 rounded-2xl font-black text-lg active:scale-95 transition flex items-center justify-center gap-3"><LogOut size={20}/> CERRAR SESIÓN</button></div> ); }