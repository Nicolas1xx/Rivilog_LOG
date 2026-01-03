'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronRight, ChevronLeft, CheckCircle2, FileText, 
  Wallet, Camera, Phone, Mail, FileUp, Loader2, AlertTriangle,
  Lock, X, ShieldAlert, Clock, Calendar, Copy
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const RivilogLogo = ({ className = "w-72 h-28" }) => (
  <svg viewBox="0 0 300 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M160 20L190 35L140 40L160 20Z" fill="#3b82f6" />
    <path d="M145 25L175 32L135 35L145 25Z" fill="#1e3a8a" />
    <text x="10" y="80" fontFamily="Arial Black, sans-serif" fontSize="54" fontWeight="900" fill="white" style={{ fontStyle: 'italic' }}>
      RIVI<tspan fill="#3b82f6">LOG</tspan>
    </text>
    <rect x="155" y="82" width="120" height="6" fill="#3b82f6" rx="3" />
  </svg>
);

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [protocoloGerado, setProtocoloGerado] = useState('');
  
  const [showLogin, setShowLogin] = useState(false);
  const [adminAuth, setAdminAuth] = useState({ user: '', pass: '' });

  const [formData, setFormData] = useState({
    nome: '', data: '', placa: '', operacao: '', valor: '', 
    telefone: '', email: '',
    foto_comprovante: null as File | null,
    extrato_pdf: null as File | null
  });

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const gerarProtocolo = () => {
    const dataAtual = new Date();
    const ano = dataAtual.getFullYear();
    const aleatorio = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `RIV-${ano}-${aleatorio}`;
  };

  const handleTelefoneMask = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, ""); 
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length > 2) v = "(" + v.substring(0, 2) + ") " + v.substring(2);
    if (v.length > 9) v = v.substring(0, 10) + "-" + v.substring(10);
    setFormData({ ...formData, telefone: v });
  };

  const handlePlacaMask = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length > 7) value = value.substring(0, 7);
    setFormData({ ...formData, placa: value });
  };

  const handleCurrencyMask = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    const options = { minimumFractionDigits: 2 };
    const result = new Intl.NumberFormat("pt-BR", options).format(
      parseFloat(value) / 100
    );
    setFormData({ ...formData, valor: result });
  };

  const handleAdminLogin = () => {
    if (adminAuth.user === 'rivilog@adm' && adminAuth.pass === '33529710') {
      router.push('/admin');
    } else {
      alert('Credenciais inválidas');
    }
  };

  const handleNextStep = () => {
    if (step === 2) {
      if (!formData.placa || formData.placa.length < 7) {
        alert("ERRO: A placa é obrigatória e deve ter 7 caracteres.");
        return;
      }
    }

    if (step === 4) {
      if (!formData.valor || formData.valor.endsWith(",00") || formData.valor === "0,00") {
        alert("FALHA: É obrigatório informar os centavos corretos.");
        return;
      }
    }

    if (step === 7) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (formData.telefone.length < 14) {
        alert("ERRO: Telefone com DDD é obrigatório.");
        return;
      }
      if (!emailRegex.test(formData.email)) {
        alert("ERRO: Insira um e-mail válido.");
        return;
      }
    }

    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!formData.nome) { alert("Informe seu nome."); return; }
    setLoading(true);
    const novoProtocolo = gerarProtocolo();
    
    try {
      let fotoUrl = null;
      let pdfUrl = null;

      if (formData.foto_comprovante) {
        const fileName = `foto-${Date.now()}-${formData.placa}.jpg`;
        await supabase.storage.from('comprovantes').upload(fileName, formData.foto_comprovante);
        fotoUrl = supabase.storage.from('comprovantes').getPublicUrl(fileName).data.publicUrl;
      }

      if (formData.extrato_pdf) {
        const fileName = `pdf-${Date.now()}-${formData.placa}.pdf`;
        await supabase.storage.from('comprovantes').upload(fileName, formData.extrato_pdf);
        pdfUrl = supabase.storage.from('comprovantes').getPublicUrl(fileName).data.publicUrl;
      }

      const { error: dbErr } = await supabase.from('pedagios').insert([{
        protocolo: novoProtocolo,
        nome_motorista: formData.nome,
        data_viagem: formData.data,
        placa: formData.placa.toUpperCase(),
        operacao: formData.operacao,
        valor: parseFloat(formData.valor.replace('.', '').replace(',', '.')) || 0,
        telefone: formData.telefone,
        email: formData.email,
        url_comprovante: fotoUrl,
        url_extrato: pdfUrl
      }]);

      if (dbErr) throw dbErr;

      // --- INÍCIO DO BLOCO DE ENVIO DE E-MAIL ---
      try {
        await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            nome: formData.nome,
            protocolo: novoProtocolo,
            placa: formData.placa
          }),
        });
      } catch (emailErr) {
        // Apenas logamos o erro para não travar a tela de sucesso do motorista
        console.error("Falha ao disparar e-mail:", emailErr);
      }
      // --- FIM DO BLOCO DE ENVIO DE E-MAIL ---

      setProtocoloGerado(novoProtocolo);
      setSuccess(true);
    } catch (err) { 
      alert('Erro no envio. Verifique a conexão.'); 
    } finally { 
      setLoading(false); 
    }
  };

  if (success) return (
    <div className="min-h-screen bg-[#000b1a] flex items-center justify-center p-6 text-white relative">
       {/* Logo centralizada no fundo na tela de sucesso também */}
       <div className="fixed inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <RivilogLogo className="w-[80%] h-auto opacity-[0.03] grayscale" />
      </div>

      <div className="text-center animate-in zoom-in duration-500 relative z-10">
        <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-5xl font-black mb-2 uppercase italic">Protocolado!</h2>
        
        {/* EXIBIÇÃO DO PROTOCOLO */}
        <div className="mb-8 mt-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-2">Número do Protocolo</p>
          <div className="flex items-center justify-center gap-4">
            <span className="text-3xl font-mono font-black text-white tracking-widest">{protocoloGerado}</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(protocoloGerado);
                alert('Protocolo copiado!');
              }}
              className="p-2 hover:bg-blue-600 rounded-lg transition-colors text-white/50 hover:text-white"
            >
              <Copy size={20} />
            </button>
          </div>
        </div>

        <p className="mb-8 opacity-60 text-lg max-w-sm mx-auto">Salve seu número de protocolo para futuras consultas com o administrativo.</p>
        <button onClick={() => window.location.reload()} className="bg-white text-black px-12 py-5 rounded-full font-bold hover:scale-105 transition uppercase tracking-widest text-lg">Novo Envio</button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#000d1a] text-white selection:bg-blue-500 relative overflow-hidden font-sans">
      
      {/* Background Decor & Watermark Logo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full"></div>
        <RivilogLogo className="w-[80%] h-auto opacity-[0.03] grayscale" />
      </div>

      <div className="absolute top-6 right-6 z-50">
        {!showLogin ? (
          <button 
            onClick={() => setShowLogin(true)}
            className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-blue-600 transition-all text-white/30 hover:text-white"
          >
            <Lock size={20} />
          </button>
        ) : (
          <div className="bg-[#001229] border border-blue-500/30 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300 w-64">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Acesso Restrito</span>
              <button onClick={() => setShowLogin(false)} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <input 
              type="text" 
              placeholder="USUÁRIO" 
              className="bg-white/5 border border-white/10 p-2 rounded text-xs outline-none focus:border-blue-500 font-bold text-white placeholder:text-white/20"
              onChange={(e) => setAdminAuth({...adminAuth, user: e.target.value})}
            />
            <input 
              type="password" 
              placeholder="SENHA" 
              className="bg-white/5 border border-white/10 p-2 rounded text-xs outline-none focus:border-blue-500 font-bold text-white placeholder:text-white/20"
              onChange={(e) => setAdminAuth({...adminAuth, pass: e.target.value})}
            />
            <button 
              onClick={handleAdminLogin}
              className="bg-blue-600 py-2 rounded text-[10px] font-black uppercase hover:bg-blue-500 text-white transition-colors"
            >
              Acessar Painel
            </button>
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <header className="w-full flex justify-center pt-16 pb-6">
          <RivilogLogo className="w-80 h-32 drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]" />
        </header>

        <div className="w-full max-w-6xl mx-auto px-6 pb-24">
          {step === 0 ? (
            <div className="animate-in fade-in zoom-in-95 duration-700">
              
              {/* ATENÇÃO MÁXIMA BANNER */}
              <div className="mb-10 relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-[#0a0505] border-2 border-red-600/50 rounded-3xl p-6 flex items-center justify-center gap-6 overflow-hidden">
                  <div className="flex-shrink-0 bg-red-600 p-4 rounded-2xl animate-pulse">
                    <ShieldAlert size={40} className="text-white" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-red-500 font-black text-2xl uppercase italic tracking-tighter leading-none">Atenção Máxima</h2>
                    <p className="text-white font-bold text-lg md:text-xl uppercase tracking-tight">Não serão aceitos comprovantes retroativos</p>
                  </div>
                  <div className="hidden md:block ml-auto opacity-20">
                    <ShieldAlert size={80} className="text-red-600" />
                  </div>
                </div>
              </div>

              {/* GRID DE INFORMAÇÕES ORGANIZADAS */}
              <div className="grid md:grid-cols-2 gap-8 mb-12">
                
                {/* REGRAS */}
                <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-8 rounded-[40px] hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-600/20 p-3 rounded-2xl">
                      <FileText className="text-blue-500" size={28} />
                    </div>
                    <h3 className="font-black text-xl uppercase italic">Diretrizes de Envio</h3>
                  </div>
                  
                  <div className="space-y-5">
                    {[
                      { icon: <Calendar size={18}/>, text: "Data correta da rota (Dia/Mês/Ano)" },
                      { icon: <FileUp size={18}/>, text: "Placa no Padrão Mercosul (7 caracteres)" },
                      { icon: <CheckCircle2 size={18}/>, text: "Comprovantes 100% Legíveis" }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                        <span className="text-blue-500">{item.icon}</span>
                        <span className="text-sm font-bold uppercase tracking-tight text-gray-300">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PAGAMENTOS */}
                <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-8 rounded-[40px] hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-600/20 p-3 rounded-2xl">
                      <Wallet className="text-blue-500" size={28} />
                    </div>
                    <h3 className="font-black text-xl uppercase italic">Ciclo de Reembolso</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="group relative bg-gradient-to-r from-blue-600/20 to-transparent p-6 rounded-3xl border border-blue-500/20">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Primeiro Ciclo</p>
                          <p className="text-lg font-bold text-white uppercase">Dia 01 ao dia 15</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-white/40 uppercase mb-1 text-right">Pagamento</p>
                          <p className="text-xl font-black text-blue-500">DIA 05</p>
                        </div>
                      </div>
                    </div>

                    <div className="group relative bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Segundo Ciclo</p>
                          <p className="text-lg font-bold text-white uppercase">Dia 16 ao dia 30</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-white/40 uppercase mb-1 text-right">Pagamento</p>
                          <p className="text-xl font-black text-blue-500">DIA 20</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTÃO PRINCIPAL */}
              <button 
                onClick={() => setStep(1)} 
                className="group relative w-full overflow-hidden rounded-[35px] bg-white p-1 transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                <div className="relative flex items-center justify-center gap-4 rounded-[30px] bg-white px-8 py-8 transition-all group-hover:bg-blue-600">
                  <span className="text-2xl font-black uppercase italic tracking-[0.2em] text-black transition-all group-hover:text-white">
                    Iniciar Protocolo de Envio
                  </span>
                  <ChevronRight size={32} className="text-blue-600 transition-all group-hover:translate-x-2 group-hover:text-white" />
                </div>
              </button>

              <p className="mt-8 text-center text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">
                Sistema de Gestão de Frotas v2.0 • Rivilog Logística
              </p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-10 duration-500">
              <button onClick={() => setStep(step - 1)} className="mb-10 text-blue-500 font-bold text-sm uppercase flex items-center gap-2 hover:text-white transition group">
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Voltar
              </button>

              <div className="space-y-16">
                
                {step === 1 && (
                  <div className="space-y-6">
                    <span className="text-red-600 font-black text-6xl opacity-20 italic">01</span>
                    <h2 className="text-4xl font-black italic uppercase">Data da Viagem</h2>
                    <p className="text-white/40 text-xs uppercase font-bold italic tracking-wider">Data da realização rota: DIA / MÊS / ANO</p>
                    <input autoFocus type="date" className="w-full bg-transparent border-b-4 border-white/10 py-6 text-4xl font-bold focus:border-blue-500 outline-none transition" onChange={e => setFormData({...formData, data: e.target.value})} />
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <span className="text-red-600 font-black text-6xl opacity-20 italic">02</span>
                    <h2 className="text-4xl font-black italic uppercase text-white">Placa do Veículo</h2>
                    <p className="text-white/40 text-xs uppercase font-bold italic tracking-wider">Padrão Mercosul (OBRIGATÓRIO)</p>
                    
                    <div className="relative w-full max-w-md mx-auto bg-white rounded-xl border-[6px] border-gray-800 overflow-hidden shadow-2xl h-48 flex flex-col">
                      <div className="bg-[#003399] w-full h-10 flex items-center justify-between px-4">
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded-full bg-white/20"></div>
                          <div className="w-4 h-4 rounded-full bg-white/20"></div>
                        </div>
                        <span className="text-white font-bold text-sm tracking-widest">BRASIL</span>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/0/05/Flag_of_Brazil.svg" className="w-6 h-4" alt="BR" />
                      </div>
                      <div className="flex-1 flex items-center justify-center px-4">
                        <input 
                          autoFocus 
                          type="text" 
                          placeholder="ABC1D23" 
                          maxLength={7} 
                          value={formData.placa}
                          className="w-full bg-transparent text-center text-7xl font-bold outline-none uppercase tracking-tighter text-black placeholder:opacity-10" 
                          onChange={handlePlacaMask} 
                        />
                      </div>
                    </div>

                    {formData.placa.length > 0 && formData.placa.length < 7 && (
                      <p className="text-red-500 text-[10px] font-black uppercase italic text-center">A placa deve conter 7 dígitos.</p>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <span className="text-red-600 font-black text-6xl opacity-20 italic">03</span>
                    <h2 className="text-4xl font-black italic uppercase">Operação</h2>
                    <p className="text-white/40 text-xs uppercase font-bold italic tracking-wider">
                      Escolha: J&T EXPRESS ou IMILE SEGUNDARIA
                    </p>
                    <div className="grid gap-6 pt-4">
                      {[
                        { id: 'J&T EXPRESS', img: './jt_logo.jpeg' }, 
                        { id: 'IMILE SEGUNDARIA', img: './imile_logo.jpeg' }
                      ].map(op => (
                        <button 
                          key={op.id} 
                          onClick={() => { setFormData({...formData, operacao: op.id}); setStep(4); }} 
                          className={`p-6 rounded-xl border-2 flex items-center gap-6 transition-all ${
                            formData.operacao === op.id 
                            ? 'bg-blue-600 border-blue-600 shadow-[0_0_30px_rgba(59,130,246,0.4)]' 
                            : 'border-white/10 bg-white/5 hover:border-white/30'
                          }`}
                        >
                          <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center p-2 shrink-0">
                            <img src={op.img} alt={op.id} className="w-full h-full object-contain" />
                          </div>
                          <span className="font-black text-2xl uppercase italic tracking-tight text-left">
                            {op.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-6">
                    <span className="text-red-600 font-black text-6xl opacity-20 italic">04</span>
                    <h2 className="text-4xl font-black italic uppercase">VALOR DO PEDAGIO</h2>
                    <p className="text-white/40 text-xs uppercase font-bold italic tracking-wider">Valor da Ida e Volta - Centavos Obrigatórios</p>
                    <div className="flex items-center border-b-4 border-white/10 focus-within:border-blue-500 transition">
                      <span className="text-3xl font-bold mr-6 opacity-30 text-white">R$</span>
                      <input 
                        autoFocus 
                        type="text" 
                        inputMode="numeric"
                        placeholder="0,00" 
                        value={formData.valor}
                        className="w-full bg-transparent py-6 text-5xl font-bold outline-none text-white" 
                        onChange={handleCurrencyMask} 
                      />
                    </div>
                    <p className="text-red-500 text-[10px] font-black uppercase italic">Não utilize vírgula ou ponto. Digite apenas os números.</p>
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-6">
                    <div className="w-full overflow-hidden rounded-md border-2 border-white/10 bg-white/5 shadow-lg">
                      <img src="./comprovantes.jpeg" alt="Exemplo de Comprovante" className="w-full h-auto max-h-[300px] object-contain block mx-auto p-2" />
                    </div>
                    <span className="text-red-600 font-black text-6xl opacity-20 italic">05</span>
                    <h2 className="text-4xl font-black italic uppercase leading-tight">INSIRA FOTO DO COMPROVANTE DE PAGAMENTO</h2>
                    <p className="text-white/40 text-xs uppercase font-bold italic tracking-wider">Juntar todos os comprovantes em uma única foto. Caso não tenha os recibos, inserir o extrato no próximo item.</p>
                    <input 
                      ref={fotoInputRef} 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={e => setFormData({...formData, foto_comprovante: e.target.files ? e.target.files[0] : null})} 
                    />
                    <div 
                      onClick={() => fotoInputRef.current?.click()} 
                      className={`w-full h-64 border-4 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${formData.foto_comprovante ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 hover:bg-white/10'}`}
                    >
                      {formData.foto_comprovante ? <CheckCircle2 className="w-16 h-16 text-blue-500" /> : <Camera className="w-16 h-16 opacity-10" />}
                      <p className="mt-6 text-xs font-black uppercase tracking-[0.3em]">{formData.foto_comprovante ? 'Foto Carregada' : 'Capturar Comprovante'}</p>
                    </div>
                  </div>
                )}

                {step === 6 && (
                  <div className="space-y-6">
                    <div className="w-full overflow-hidden rounded-md border-2 border-white/10 bg-white/5 shadow-lg">
                      <img src="./extrato.jpeg" alt="Exemplo de Extrato" className="w-full h-auto max-h-[300px] object-contain block mx-auto p-2" />
                    </div>
                    <span className="text-red-600 font-black text-6xl opacity-20 italic">06</span>
                    <h2 className="text-4xl font-black italic uppercase leading-tight">ANEXAR EXTRATO EM PDF</h2>
                    <p className="text-white/40 text-xs uppercase font-bold italic tracking-wider">As informações devem corresponder com as informações mencionadas na pergunta anterior.</p>
                    <input 
                      ref={pdfInputRef} 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      onChange={e => setFormData({...formData, extrato_pdf: e.target.files ? e.target.files[0] : null})} 
                    />
                    <div 
                      onClick={() => pdfInputRef.current?.click()} 
                      className={`w-full h-64 border-4 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${formData.extrato_pdf ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 hover:bg-white/10'}`}
                    >
                      {formData.extrato_pdf ? <CheckCircle2 className="w-16 h-16 text-blue-500" /> : <FileUp className="w-16 h-16 opacity-10" />}
                      <p className="mt-6 text-xs font-black uppercase tracking-[0.3em]">{formData.extrato_pdf ? 'PDF Pronto' : 'Selecionar Extrato em PDF'}</p>
                    </div>
                  </div>
                )}

                {step === 7 && (
  <div className="space-y-10">
    <div className="space-y-6">
      <span className="text-red-600 font-black text-6xl opacity-20 italic">07</span>
      <h2 className="text-4xl font-black italic uppercase">CONTATO DO RESPONSAVEL</h2>
      <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest italic">Telefone e E-mail Obrigatórios</p>
    </div>
    <div className="space-y-8">
      <div className="flex items-center gap-6 border-b-2 border-white/10 focus-within:border-blue-500 transition">
        <Phone className="w-6 h-6 text-blue-500" />
        <input 
          type="tel" 
          placeholder="(00) 00000-0000" 
          value={formData.telefone}
          className="w-full bg-transparent py-6 text-2xl font-bold outline-none" 
          onChange={handleTelefoneMask} 
        />
      </div>
      <div className="flex items-center gap-6 border-b-2 border-white/10 focus-within:border-blue-500 transition">
        <Mail className="w-6 h-6 text-blue-500" />
        <input 
          type="email" 
          placeholder="exemplo@email.com" 
          value={formData.email}
          /* Removemos 'uppercase' e adicionamos 'lowercase' para visual */
          className="w-full bg-transparent py-6 text-2xl font-bold outline-none lowercase" 
          /* O .toLowerCase() garante que o dado seja salvo minúsculo no banco e no envio do email */
          onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} 
        />
      </div>
    </div>
  </div>
)}

                {step === 8 && (
                  <div className="space-y-6">
                    <span className="text-red-600 font-black text-6xl opacity-20 italic">08</span>
                    <h2 className="text-4xl font-black italic uppercase">Responsável</h2>
                    <input autoFocus type="text" placeholder="SEU NOME COMPLETO" className="w-full bg-transparent border-b-4 border-white/10 py-6 text-3xl font-bold focus:border-blue-500 outline-none uppercase" onChange={e => setFormData({...formData, nome: e.target.value})} />
                  </div>
                )}

                {step === 9 && (
                  <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="space-y-2">
                      <span className="text-blue-500 font-black text-6xl opacity-20 italic">09</span>
                      <h2 className="text-4xl font-black italic uppercase">Resumo do Envio</h2>
                      <p className="text-white/40 text-xs uppercase font-bold italic tracking-wider">Confira seus dados antes de finalizar</p>
                    </div>
                    
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <p className="text-white/40 uppercase font-black">Motorista:</p>
                        <p className="font-bold uppercase text-blue-400">{formData.nome}</p>
                        
                        <p className="text-white/40 uppercase font-black">Data:</p>
                        <p className="font-bold">{formData.data.split('-').reverse().join('/')}</p>
                        
                        <p className="text-white/40 uppercase font-black">Placa:</p>
                        <p className="font-bold text-blue-400">{formData.placa}</p>
                        
                        <p className="text-white/40 uppercase font-black">Operação:</p>
                        <p className="font-bold uppercase">{formData.operacao}</p>
                        
                        <p className="text-white/40 uppercase font-black">Valor Total:</p>
                        <p className="font-bold text-green-400 text-xl">R$ {formData.valor}</p>
                      </div>
                      
                      <div className="pt-4 border-t border-white/10 flex flex-wrap gap-4">
                        {formData.foto_comprovante && <span className="bg-blue-600/20 text-blue-400 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-blue-600/30">Foto Anexada</span>}
                        {formData.extrato_pdf && <span className="bg-blue-600/20 text-blue-400 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-blue-600/30">PDF Anexado</span>}
                      </div>
                    </div>
                  </div>
                )}

                {step !== 3 && (
                  <button 
                    onClick={step === 9 ? handleSubmit : handleNextStep} 
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-8 rounded-[25px] font-black text-2xl hover:bg-blue-500 transition-all shadow-2xl disabled:opacity-50 uppercase tracking-[0.3em] flex items-center justify-center gap-4"
                  >
                    {loading ? (
                      <><Loader2 className="animate-spin" size={30} /> Enviando...</>
                    ) : (
                      step === 9 ? 'Confirmar e Enviar' : 'Próxima Etapa'
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}