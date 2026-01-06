'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx'; 
import JSZip from 'jszip'; // Importação do ZIP
import { saveAs } from 'file-saver'; // Importação para salvar o arquivo
import { 
  FileText, Calendar, Phone, Mail, Eye, ArrowLeft, Search, Trash2, Filter, X, Hash, Download, Lock, Image as ImageIcon, ChevronLeft, ChevronRight, Archive
} from 'lucide-react';

const RivilogLogo = ({ className = "w-48 h-16" }) => (
  <svg viewBox="0 0 300 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M160 20L190 35L140 40L160 20Z" fill="#3b82f6" />
    <path d="M145 25L175 32L135 35L145 25Z" fill="#1e3a8a" />
    <text x="10" y="80" fontFamily="Arial Black, sans-serif" fontSize="54" fontWeight="900" fill="white" style={{ fontStyle: 'italic' }}>
      RIVI<tspan fill="#3b82f6">LOG</tspan>
    </text>
    <rect x="155" y="82" width="120" height="6" fill="#3b82f6" rx="3" />
  </svg>
);

export default function AdminPanel() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOperacao, setFilterOperacao] = useState('TODAS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados para o Modal de Fotos
  const [activePhotos, setActivePhotos] = useState<string[] | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    const checkAuth = () => {
      const isAuth = sessionStorage.getItem('rivilog_admin_access');
      if (isAuth !== 'granted') {
        router.replace('/');
      } else {
        setAuthorized(true);
        fetchData();
      }
    };
    checkAuth();
  }, [router]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: pedagios, error } = await supabase
        .from('pedagios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(pedagios || []);
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- NOVA FUNÇÃO DE BACKUP (ZIP) ---
  const handleFullBackup = async () => {
    if (filteredData.length === 0) {
      alert("Nenhum dado para baixar.");
      return;
    }

    const confirm = window.confirm(`Deseja baixar todos os arquivos de ${filteredData.length} registros?\nOs arquivos serão organizados em pastas por DATA e MOTORISTA.`);
    if (!confirm) return;

    setLoading(true);
    const zip = new JSZip();

    try {
      // Loop por cada item filtrado na tabela
      for (const item of filteredData) {
        // Formata data e nome para criar as pastas
        const dataViagem = new Date(item.data_viagem + 'T00:00:00').toLocaleDateString('pt-BR').replace(/\//g, '-');
        const nomeMotorista = (item.nome_motorista || 'SEM_NOME').toUpperCase().replace(/[^A-Z0-9 ]/g, "");
        const protocolo = item.protocolo || 'S-PROT';

        // Cria estrutura: DATA -> MOTORISTA -> ARQUIVOS
        const folder = zip.folder(dataViagem)?.folder(`${nomeMotorista} - ${protocolo}`);

        // Função auxiliar para adicionar arquivo ao ZIP
        const addFileToZip = async (url: string, filename: string) => {
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            folder?.file(filename, blob);
          } catch (e) {
            console.error(`Erro baixar ${url}`, e);
            folder?.file(`${filename}_ERRO.txt`, "Falha no download");
          }
        };

        // Adiciona Comprovantes (Multiplos ou Unico)
        if (item.urls_multiplas && item.urls_multiplas.length > 0) {
          for (let i = 0; i < item.urls_multiplas.length; i++) {
            // Tenta adivinhar extensão ou usa jpg
            const ext = item.urls_multiplas[i].toLowerCase().includes('.pdf') ? 'pdf' : 'jpg';
            await addFileToZip(item.urls_multiplas[i], `comprovante_${i + 1}.${ext}`);
          }
        } else if (item.url_comprovante) {
          const ext = item.url_comprovante.toLowerCase().includes('.pdf') ? 'pdf' : 'jpg';
          await addFileToZip(item.url_comprovante, `comprovante.${ext}`);
        }

        // Adiciona Extrato Tag
        if (item.url_extrato) {
          await addFileToZip(item.url_extrato, `extrato_tag.pdf`);
        }
      }

      // Gera o arquivo ZIP final
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `BACKUP_RIVILOG_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.zip`);

    } catch (err) {
      console.error(err);
      alert("Erro ao gerar o arquivo ZIP.");
    } finally {
      setLoading(false);
    }
  };
  // -----------------------------------

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      alert("Nenhum dado encontrado para exportar.");
      return;
    }

    const excelData = filteredData.map(item => ({
      'DATA VIAGEM': new Date(item.data_viagem + 'T00:00:00').toLocaleDateString('pt-BR'),
      'MOTORISTA': item.nome_motorista?.toUpperCase() || 'N/A',
      'PLACA': item.placa?.toUpperCase() || 'N/A',
      'OPERAÇÃO': item.operacao?.toUpperCase() || 'NÃO INFORMADA',
      'VALOR (R$)': item.valor, 
      'PROTOCOLO': item.protocolo || 'N/A',
      'CONTATO': item.telefone || 'N/A',
      'E-MAIL': item.email?.toLowerCase() || 'N/A',
      'FOTOS': item.urls_multiplas ? item.urls_multiplas.length : (item.url_comprovante ? 1 : 0),
      'DATA CADASTRO': new Date(item.created_at).toLocaleString('pt-BR')
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lançamentos Rivilog");
    XLSX.writeFile(workbook, `RIVILOG_FINANCEIRO_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  async function handleDelete(item: any) {
    const confirmacao = window.confirm(
      `CONFIRMAÇÃO DE EXCLUSÃO: O protocolo ${item.protocolo} e todas as fotos serão apagados. Deseja continuar?`
    );
    if (!confirmacao) return;

    try {
      // 1. Deletar registro do banco
      const { error: dbError } = await supabase.from('pedagios').delete().eq('id', item.id);
      if (dbError) throw dbError;

      // 2. Limpar arquivos do Storage
      const filesToDelete: string[] = [];
      if (item.urls_multiplas && item.urls_multiplas.length > 0) {
        item.urls_multiplas.forEach((url: string) => {
          const name = url.split('/').pop();
          if (name) filesToDelete.push(name);
        });
      }

      if (item.url_extrato) {
        const fileName = item.url_extrato.split('/').pop();
        if (fileName) filesToDelete.push(fileName);
      }

      if (item.url_comprovante) {
        const fileName = item.url_comprovante.split('/').pop();
        if (fileName) filesToDelete.push(fileName);
      }

      if (filesToDelete.length > 0) {
        await supabase.storage.from('comprovantes').remove(filesToDelete);
      }

      setData(prev => prev.filter(i => i.id !== item.id));
      alert("Registro e arquivos excluídos!");
    } catch (err) {
      alert("Erro ao excluir.");
    }
  }

  const filteredData = data.filter(item => {
    const nome = item.nome_motorista?.toLowerCase() || '';
    const placa = item.placa?.toLowerCase() || '';
    const protocolo = item.protocolo?.toLowerCase() || '';
    const busca = searchTerm.toLowerCase();
    
    const matchesSearch = nome.includes(busca) || placa.includes(busca) || protocolo.includes(busca);
    const matchesOp = filterOperacao === 'TODAS' || item.operacao === filterOperacao;
    
    const itemDate = item.data_viagem; 
    const matchesStart = !startDate || itemDate >= startDate;
    const matchesEnd = !endDate || itemDate <= endDate;
    
    return matchesSearch && matchesOp && matchesStart && matchesEnd;
  });

  const totalValor = filteredData.reduce((acc, curr) => acc + (curr.valor || 0), 0);

  if (!authorized) return <div className="min-h-screen bg-[#000b1a]" />;

  return (
    <main className="min-h-screen bg-[#000b1a] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      
      {/* MODAL DE FOTOS */}
      {activePhotos && (
        <div className="fixed inset-0 z-100 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
          <button 
            onClick={() => setActivePhotos(null)}
            className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"
          >
            <X size={32} />
          </button>

          <div className="relative w-full max-w-4xl flex items-center justify-center">
            {activePhotos.length > 1 && (
              <>
                <button 
                  onClick={() => setPhotoIndex(prev => (prev === 0 ? activePhotos.length - 1 : prev - 1))}
                  className="absolute left-0 p-4 bg-blue-600 rounded-full hover:scale-110 transition-transform z-10"
                >
                  <ChevronLeft size={30} />
                </button>
                <button 
                  onClick={() => setPhotoIndex(prev => (prev === activePhotos.length - 1 ? 0 : prev + 1))}
                  className="absolute right-0 p-4 bg-blue-600 rounded-full hover:scale-110 transition-transform z-10"
                >
                  <ChevronRight size={30} />
                </button>
              </>
            )}
            
            <img 
              src={activePhotos[photoIndex]} 
              className="max-h-[70vh] rounded-2xl shadow-2xl border border-white/10 object-contain"
              alt="Comprovante"
            />
          </div>

          <div className="mt-8 flex flex-col items-center gap-2">
            <p className="text-blue-400 font-black uppercase tracking-widest text-sm">
              Foto {photoIndex + 1} de {activePhotos.length}
            </p>
            <div className="flex gap-2">
              {activePhotos.map((_, idx) => (
                <div key={idx} className={`w-3 h-3 rounded-full transition-all ${idx === photoIndex ? 'bg-blue-500 scale-125' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MARCA D'AGUA DE FUNDO */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.02] select-none">
        <h1 className="text-[20vw] font-black italic tracking-tighter uppercase">RIVILOG</h1>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
          <div className="flex items-center gap-6">
            <button onClick={() => {
              sessionStorage.removeItem('rivilog_admin_access');
              router.replace('/');
            }} className="p-3 bg-red-600/10 border border-red-600/20 rounded-full hover:bg-red-600 transition-all group text-red-500 hover:text-white" title="Sair do Painel">
              <Lock className="w-6 h-6 group-hover:scale-110" />
            </button>
            <RivilogLogo />
          </div>

          <div className="flex items-center gap-4">
            
            {/* BOTÃO NOVO: BAIXAR TUDO */}
            <button 
              onClick={handleFullBackup}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black italic text-sm transition-all shadow-lg uppercase"
            >
              <Archive size={18} />
              Baixar Tudo
            </button>

            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-2xl font-black italic text-sm transition-all shadow-lg shadow-green-900/20 uppercase"
            >
              <Download size={18} />
              Exportar Excel
            </button>

            <div className="bg-blue-600/10 border border-blue-500/20 px-6 py-3 rounded-2xl text-right">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Filtrado</p>
              <h2 className="text-3xl font-black italic text-white">R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
            </div>
          </div>
        </div>

        {/* FILTROS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#001229] border border-white/10 p-4 rounded-3xl space-y-3">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
              <Search size={14} /> Pesquisar
            </label>
            <input 
              type="text" 
              placeholder="NOME, PLACA OU PROTOCOLO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-sm font-bold focus:border-blue-500 outline-none uppercase transition"
            />
          </div>

          <div className="bg-[#001229] border border-white/10 p-4 rounded-3xl space-y-3">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
              <Filter size={14} /> Operação
            </label>
            <div className="flex gap-2">
              {['TODAS', 'J&T EXPRESS', 'IMILE SEGUNDARIA'].map((op) => (
                <button
                  key={op}
                  onClick={() => setFilterOperacao(op)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all border ${
                    filterOperacao === op 
                    ? 'bg-blue-600 border-blue-500 text-white' 
                    : 'bg-white/5 border-white/5 text-white/40'
                  }`}
                >
                  {op === 'IMILE SEGUNDARIA' ? 'IMILE' : op.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#001229] border border-white/10 p-4 rounded-3xl space-y-3">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} /> Período
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-xs font-bold outline-none"
              />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-xs font-bold outline-none"
              />
            </div>
          </div>
        </div>

        {/* TABELA */}
        <div className="bg-[#001229]/60 backdrop-blur-xl border border-white/5 rounded-4xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-blue-500/5 border-b border-white/5 text-[10px] font-black uppercase text-blue-400 tracking-widest">
                  <th className="p-6 text-center"><Hash size={14}/></th>
                  <th className="p-6">Protocolo</th>
                  <th className="p-6">Data</th>
                  <th className="p-6">Motorista</th>
                  <th className="p-6">Placa</th>
                  <th className="p-6">Operação</th>
                  <th className="p-6 text-right">Valor</th>
                  <th className="p-6 text-center">Arquivos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={8} className="p-20 text-center animate-pulse font-black text-white/10 uppercase">Carregando...</td></tr>
                ) : filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-500/2 transition-colors group">
                    <td className="p-6 text-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto group-hover:scale-125 transition-transform"></div>
                    </td>
                    <td className="p-6">
                      <span className="font-mono text-blue-400 font-black text-sm tracking-wider">{item.protocolo || 'N/A'}</span>
                    </td>
                    <td className="p-6 font-bold text-sm">
                       {new Date(item.data_viagem + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-6">
                      <div className="font-black text-xs uppercase text-white/90">{item.nome_motorista}</div>
                    </td>
                    <td className="p-6">
                      <span className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-black text-xs">
                        {item.placa}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase ${
                        item.operacao?.includes('IMILE') ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                      }`}>
                        {item.operacao || 'N/A'}
                      </span>
                    </td>
                    <td className="p-6 text-right font-black text-sm">
                      R$ {item.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-6">
                      <div className="flex justify-center gap-2">
                        {item.url_extrato && (
                          <a href={item.url_extrato} target="_blank" className="p-2.5 bg-white text-black rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg" title="Ver Extrato PDF">
                            <FileText size={18} />
                          </a>
                        )}

                        {(item.urls_multiplas && item.urls_multiplas.length > 0) ? (
                          <button 
                            onClick={() => {
                              setActivePhotos(item.urls_multiplas);
                              setPhotoIndex(0);
                            }}
                            className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-400 transition-all shadow-lg flex items-center gap-2" 
                          >
                            <ImageIcon size={18} />
                            <span className="text-[10px] font-black">{item.urls_multiplas.length}</span>
                          </button>
                        ) : item.url_comprovante && (
                          <button 
                            onClick={() => {
                              setActivePhotos([item.url_comprovante]);
                              setPhotoIndex(0);
                            }}
                            className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-400 transition-all shadow-lg"
                          >
                            <Eye size={18} />
                          </button>
                        )}

                        <button 
                          onClick={() => handleDelete(item)}
                          className="p-2.5 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-500/10"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}