'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx'; 
import { 
  FileText, Calendar, Phone, Mail, Eye, ArrowLeft, Search, Trash2, Filter, X, Hash, Download
} from 'lucide-react';
import Link from 'next/link';

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
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOperacao, setFilterOperacao] = useState('TODAS');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

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

  // FUNÇÃO PARA EXPORTAR PARA EXCEL ESTILIZADA
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      alert("Nenhum dado encontrado para exportar.");
      return;
    }

    // Organização e formatação para o financeiro
    const excelData = filteredData.map(item => ({
      'DATA VIAGEM': new Date(item.data_viagem + 'T00:00:00').toLocaleDateString('pt-BR'),
      'MOTORISTA': item.nome_motorista?.toUpperCase() || 'N/A',
      'PLACA': item.placa?.toUpperCase() || 'N/A',
      'OPERAÇÃO': item.operacao?.toUpperCase() || 'NÃO INFORMADA',
      'VALOR (R$)': item.valor, 
      'PROTOCOLO': item.protocolo || 'N/A',
      'CONTATO': item.telefone || 'N/A',
      'E-MAIL': item.email?.toLowerCase() || 'N/A',
      'DATA CADASTRO': new Date(item.created_at).toLocaleString('pt-BR')
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lançamentos Rivilog");

    // Configura larguras das colunas
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 20 }, 
      { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 20 }
    ];

    const fileName = `RIVILOG_FINANCEIRO_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  async function handleDelete(item: any) {
    const confirmacao = window.confirm(
      `CONFIRMAÇÃO DE EXCLUSÃO: O protocolo ${item.protocolo} será apagado permanentemente. Deseja continuar?`
    );
    if (!confirmacao) return;

    try {
      const { error: dbError } = await supabase.from('pedagios').delete().eq('id', item.id);
      if (dbError) throw dbError;

      if (item.url_extrato) {
        const fileName = item.url_extrato.split('/').pop();
        await supabase.storage.from('comprovantes').remove([fileName]);
      }
      if (item.url_comprovante) {
        const fileName = item.url_comprovante.split('/').pop();
        await supabase.storage.from('comprovantes').remove([fileName]);
      }

      setData(prev => prev.filter(i => i.id !== item.id));
      alert("Registro excluído com sucesso!");
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

  return (
    <main className="min-h-screen bg-[#000b1a] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.02] select-none">
        <h1 className="text-[20vw] font-black italic tracking-tighter uppercase">RIVILOG</h1>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="p-3 bg-white/5 rounded-full hover:bg-blue-600 transition-all group">
              <ArrowLeft className="w-6 h-6 group-hover:scale-110" />
            </Link>
            <RivilogLogo />
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-2xl font-black italic text-sm transition-all shadow-lg shadow-green-900/20 uppercase"
            >
              <Download size={18} />
              Exportar Planilha
            </button>

            <div className="bg-blue-600/10 border border-blue-500/20 px-6 py-3 rounded-2xl text-right">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Filtrado</p>
              <h2 className="text-3xl font-black italic text-white">R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#001229] border border-white/10 p-4 rounded-[24px] space-y-3">
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

          <div className="bg-[#001229] border border-white/10 p-4 rounded-[24px] space-y-3">
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
                    ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  {op === 'IMILE SEGUNDARIA' ? 'IMILE' : op.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#001229] border border-white/10 p-4 rounded-[24px] space-y-3">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} /> Período da Viagem
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:border-blue-500 transition"
              />
              <span className="text-white/20">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:border-blue-500 transition"
              />
              {(startDate || endDate) && (
                <button onClick={() => {setStartDate(''); setEndDate('');}} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#001229]/60 backdrop-blur-xl border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-blue-500/5 border-b border-white/5 text-[10px] font-black uppercase text-blue-400 tracking-[0.1em]">
                  <th className="p-6 text-center"><Hash size={14}/></th>
                  <th className="p-6">Protocolo</th>
                  <th className="p-6">Data Viagem</th>
                  <th className="p-6">Responsável</th>
                  <th className="p-6">Placa</th>
                  <th className="p-6">Operação</th>
                  <th className="p-6 text-right">Valor</th>
                  <th className="p-6 text-center">Arquivos / Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={8} className="p-20 text-center animate-pulse font-black text-white/10 uppercase tracking-widest">Sincronizando dados...</td></tr>
                ) : filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                    <td className="p-6 text-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto group-hover:scale-125 transition-transform"></div>
                    </td>
                    <td className="p-6">
                      <span className="font-mono text-blue-400 font-black text-sm tracking-wider">{item.protocolo || 'N/A'}</span>
                    </td>
                    <td className="p-6">
                      <div className="text-sm font-bold">
                         {new Date(item.data_viagem + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="font-black text-xs uppercase text-white/90">{item.nome_motorista}</div>
                      <div className="text-[10px] text-white/30 font-bold mt-1 uppercase">
                        <span>{item.telefone}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-black text-xs tracking-tighter">
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
                    <td className="p-6 text-right">
                      <span className="text-white font-black text-sm">R$ {item.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex justify-center gap-2">
                        {item.url_extrato && (
                          <a href={item.url_extrato} target="_blank" className="p-2.5 bg-white text-black rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg" title="Ver Extrato PDF">
                            <FileText size={18} />
                          </a>
                        )}
                        {item.url_comprovante && (
                          <a href={item.url_comprovante} target="_blank" className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-white hover:text-black transition-all shadow-lg" title="Ver Foto Comprovante">
                            <Eye size={18} />
                          </a>
                        )}
                        <button 
                          onClick={() => handleDelete(item)}
                          className="p-2.5 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-500/10"
                          title="Excluir Registro"
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
          {filteredData.length === 0 && !loading && (
            <div className="p-20 text-center text-white/20 font-black uppercase italic tracking-widest">Nenhum registro encontrado</div>
          )}
        </div>
      </div>
    </main>
  );
}