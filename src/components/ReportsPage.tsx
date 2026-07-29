import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Share2, 
  Filter as FilterIcon, 
  ChevronRight, 
  PieChart, 
  BarChart as BarChartIcon, 
  Activity,
  Users,
  MapPin,
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileUp,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart as RePieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Patient, Movement, User, AccessType, CITIES, PROFESSIONALS } from '../types';

interface ReportFilter {
  startDate: string;
  endDate: string;
  city: string;
  diagnosis: string;
  professional: string;
  status: string;
}

type ReportType = 
  | 'active_patients' 
  | 'patients_by_city' 
  | 'patients_by_diagnosis' 
  | 'patients_by_professional' 
  | 'discharges_period' 
  | 'entries_period' 
  | 'waiting_list' 
  | 'investigation' 
  | 'general_movements';

export const ReportsPage = ({ 
  patients, 
  movements, 
  currentUser,
  availableCities,
  availableProfessionals,
  availableDiagnoses
}: { 
  patients: Patient[], 
  movements: Movement[], 
  currentUser: User,
  availableCities: string[],
  availableProfessionals: string[],
  availableDiagnoses: string[]
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    city: '',
    diagnosis: '',
    professional: '',
    status: ''
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const reportOptions = [
    { id: 'active_patients', title: 'Pacientes Ativos', icon: Users, color: 'emerald' },
    { id: 'patients_by_city', title: 'Pacientes por Município', icon: MapPin, color: 'blue' },
    { id: 'patients_by_diagnosis', title: 'Pacientes por Diagnóstico', icon: Stethoscope, color: 'purple' },
    { id: 'patients_by_professional', title: 'Pacientes por Profissional', icon: Activity, color: 'orange' },
    { id: 'entries_period', title: 'Entradas no Período', icon: FileUp, color: 'emerald' },
    { id: 'discharges_period', title: 'Altas no Período', icon: CheckCircle2, color: 'red' },
    { id: 'waiting_list', title: 'Pacientes em Espera', icon: Clock, color: 'amber' },
    { id: 'investigation', title: 'Pacientes em Investigação', icon: AlertCircle, color: 'indigo' },
    { id: 'general_movements', title: 'Movimentações Gerais', icon: FileText, color: 'slate' },
  ] as const;

  const dataFiltered = useMemo(() => {
    // 1. Role Filter
    let basePatients = [...patients];
    let baseMovements = [...movements];

    if (currentUser.accessType === 'Profissional') {
      const nameClean = currentUser.name.split(' (')[0];
      basePatients = basePatients.filter(p => p.professionals.some(pro => pro.includes(nameClean)));
      baseMovements = baseMovements.filter(m => m.professionals.some(pro => pro.includes(nameClean)));
    }

    // 2. Common logic filtering
    const applyCommonFilters = (items: any[]) => {
      return items.filter(item => {
        const matchCity = filters.city ? (item.city === filters.city) : true;
        const matchPro = filters.professional 
          ? (item.responsibleProfessional?.includes(filters.professional) || item.professionals?.some((p: string) => p.includes(filters.professional))) 
          : true;
        const matchDiagnosis = filters.diagnosis ? (item.diagnoses?.some((d: string) => d.includes(filters.diagnosis))) : true;
        const matchStatus = filters.status ? (item.status === filters.status) : true;
        return matchCity && matchPro && matchDiagnosis && matchStatus;
      });
    };

    switch (selectedReport) {
      case 'active_patients':
        return applyCommonFilters(basePatients.filter(p => p.status === 'Ativo'));
      case 'waiting_list':
        return applyCommonFilters(basePatients.filter(p => p.status === 'Espera'));
      case 'investigation':
        return applyCommonFilters(basePatients.filter(p => p.status === 'Investigação'));
      case 'patients_by_city':
      case 'patients_by_diagnosis':
      case 'patients_by_professional':
        return applyCommonFilters(basePatients);
      case 'entries_period': {
        const entryMovements = baseMovements.filter(m => 
          m.type === 'Entrada' && 
          m.date >= filters.startDate && 
          m.date <= `${filters.endDate}T23:59:59`
        );
        const existingPatientIds = new Set(entryMovements.map(m => m.patientId));

        const fallbackMovements: Movement[] = basePatients
          .filter(p => {
            if (existingPatientIds.has(p.id)) return false;
            const pDate = p.entryDate || p.createdAt?.substring(0, 10) || '';
            return pDate >= filters.startDate && pDate <= filters.endDate;
          })
          .map(p => ({
            id: `synth_entry_${p.id}`,
            patientId: p.id,
            patientName: p.name,
            medicalRecordNumber: p.medicalRecordNumber,
            diagnoses: p.diagnoses || [],
            type: 'Entrada' as const,
            date: p.entryDate || p.createdAt?.substring(0, 10) || filters.startDate,
            professionals: p.professionals || [],
            responsibleProfessional: p.updatedBy || '',
            observations: 'Admissão inicial do paciente',
            createdAt: p.createdAt || new Date().toISOString()
          }));

        return applyCommonFilters([...entryMovements, ...fallbackMovements]);
      }
      case 'discharges_period':
        return applyCommonFilters(baseMovements.filter(m => 
          m.type === 'Alta' && 
          m.date >= filters.startDate && 
          m.date <= `${filters.endDate}T23:59:59`
        ));
      case 'general_movements':
        return applyCommonFilters(baseMovements.filter(m => 
          m.date >= filters.startDate && 
          m.date <= `${filters.endDate}T23:59:59`
        ));
      default:
        return [];
    }
  }, [selectedReport, patients, movements, filters, currentUser]);

  const stats = useMemo(() => {
    if (!selectedReport) return null;
    
    const count = dataFiltered.length;
    
    // City chart data
    const cityData = availableCities.map(city => ({
      name: city,
      value: dataFiltered.filter((p: any) => p.city === city).length
    })).filter(c => c.value > 0);

    // Diagnosis chart data
    const diagnosisData = availableDiagnoses.map(diag => ({
      name: diag,
      value: dataFiltered.filter((p: any) => p.diagnoses?.includes(diag)).length
    })).filter(d => d.value > 0);

    return { count, cityData, diagnosisData };
  }, [dataFiltered, selectedReport]);

  const exportPDF = () => {
    const doc = new jsPDF() as any;
    const date = new Date().toLocaleString();
    const activeReport = reportOptions.find(r => r.id === selectedReport);

    // Header
    doc.setFillColor(6, 78, 59); // #064e3b
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CER POLICLÍNICA', 105, 18, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Gestão de Pacientes e Movimentações', 105, 25, { align: 'center' });
    doc.text(`Relatório: ${activeReport?.title || ''}`, 105, 32, { align: 'center' });

    // Info
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(`Emitido em: ${date}`, 15, 50);
    doc.text(`Responsável: ${currentUser.name}`, 15, 55);
    doc.text(`Período: ${filters.startDate} a ${filters.endDate}`, 15, 60);

    // Summary box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 65, 180, 20, 3, 3, 'F');
    doc.setTextColor(6, 78, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO QUANTITATIVO', 25, 74);
    doc.setFontSize(14);
    doc.text(`${dataFiltered.length} Registros encontrados`, 25, 81);

    // Table
    const tableData = dataFiltered.map((item: any) => [
      item.name || item.patientName,
      item.medicalRecordNumber || '',
      item.city || item.type || '',
      item.status || (item.date ? new Date(item.date).toLocaleDateString() : ''),
      item.responsibleProfessional || item.professionals?.join(', ') || ''
    ]);

    doc.autoTable({
      startY: 95,
      head: [['Nome / Paciente', 'Prontuário', 'Local / Tipo', 'Situação / Data', 'Profissionais']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 250, 248] },
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`relatorio_${selectedReport}_${new Date().getTime()}.pdf`);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(dataFiltered.map((item: any) => ({
      Nome: item.name || item.patientName,
      Prontuário: item.medicalRecordNumber,
      Cidade: item.city || '',
      Status: item.status || '',
      Tipo: item.type || '',
      Data: item.date || item.createdAt,
      Profissionais: item.professionals?.join(', ') || '',
      Diagnósticos: item.diagnoses?.join(', ') || '',
      Observações: item.observations || ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorio_${selectedReport}_${new Date().getTime()}.xlsx`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#064e3b] tracking-tight">Módulo de Relatórios</h2>
          <p className="text-sm font-medium text-gray-500">Geração de documentos e análise de dados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Report Selection Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Tipos Disponíveis</h3>
            <div className="space-y-2">
              {reportOptions.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id as ReportType)}
                  className={`w-full text-left p-4 rounded-2xl flex items-center gap-3 transition-all ${
                    selectedReport === report.id 
                      ? 'bg-[#064e3b] text-white shadow-lg shadow-emerald-900/20' 
                      : 'bg-gray-50 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${selectedReport === report.id ? 'bg-white/20' : 'bg-white'}`}>
                    <report.icon size={18} className={selectedReport === report.id ? 'text-white' : `text-${report.color}-600`} />
                  </div>
                  <span className="text-sm font-bold flex-1">{report.title}</span>
                  {selectedReport === report.id && <ChevronRight size={16} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters and Preview Area */}
        <div className="lg:col-span-3 space-y-6">
          {selectedReport ? (
            <>
              {/* Active Filters */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <FilterIcon size={20} className="text-[#064e3b]" />
                  <h3 className="text-lg font-black text-[#064e3b] tracking-tight">Filtros de Data e Categoria</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Inicial</label>
                    <input 
                      type="date" 
                      value={filters.startDate}
                      onChange={e => setFilters({...filters, startDate: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Final</label>
                    <input 
                      type="date" 
                      value={filters.endDate}
                      onChange={e => setFilters({...filters, endDate: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Município</label>
                    <select 
                      value={filters.city}
                      onChange={e => setFilters({...filters, city: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                    >
                      <option value="">Todos</option>
                      {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Diagnóstico</label>
                    <select 
                      value={filters.diagnosis}
                      onChange={e => setFilters({...filters, diagnosis: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                    >
                      <option value="">Todos</option>
                      {availableDiagnoses.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Profissional</label>
                    <select 
                      value={filters.professional}
                      onChange={e => setFilters({...filters, professional: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                    >
                      <option value="">Todos</option>
                      {availableProfessionals.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={() => setIsPreviewOpen(true)}
                      className="w-full bg-[#064e3b] text-white py-3.5 rounded-xl font-black uppercase tracking-widest hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10 transition-all flex items-center justify-center gap-2"
                    >
                      <FileText size={18} />
                      Gerar Pré-visualização
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Visualization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-[#064e3b] uppercase tracking-widest">Distribuição por Município</h3>
                    <MapPin size={16} className="text-blue-500" />
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.cityData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="value" fill="#064e3b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-[#064e3b] uppercase tracking-widest">Top Diagnósticos</h3>
                    <Stethoscope size={16} className="text-purple-500" />
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={stats?.diagnosisData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats?.diagnosisData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#064e3b', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][index % 6]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 rounded-[3rem] border-2 border-dashed border-gray-200">
               <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
                 <FilterIcon size={40} />
               </div>
               <h3 className="text-2xl font-black text-[#064e3b] mb-2 tracking-tight">Selecione um Relatório</h3>
               <p className="text-gray-500 max-w-sm font-medium">
                 Escolha um dos tipos de relatório ao lado para filtrar os dados e gerar o documento oficial.
               </p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPreviewOpen(false)}
              className="absolute inset-0 bg-[#064e3b]/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-slate-50 w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-emerald-50"
            >
              {/* Modal Header */}
              <div className="bg-[#064e3b] p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Pré-visualização do Relatório</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Confira os dados antes de exportar</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={exportExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-emerald-500/20"
                  >
                    <FileSpreadsheet size={16} /> XLXS
                  </button>
                  <button 
                    onClick={exportPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-[#064e3b] hover:bg-emerald-50 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg"
                  >
                    <Download size={16} /> Baixar PDF
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                  >
                    <Printer size={20} />
                  </button>
                  <button 
                    onClick={() => setIsPreviewOpen(false)}
                    className="p-2.5 hover:bg-white/10 rounded-xl transition-all"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>

              {/* PDF Mock/Preview Content */}
              <div className="flex-1 overflow-y-auto p-12 bg-white print:p-0">
                <div id="printable-report" className="max-w-4xl mx-auto border border-gray-100 shadow-sm p-12 space-y-12">
                   {/* Header */}
                   <div className="flex items-start justify-between border-b-4 border-[#064e3b] pb-8">
                     <div className="flex items-center gap-4">
                       <div className="w-16 h-16 bg-[#064e3b] rounded-2xl flex items-center justify-center text-white">
                         <Activity size={32} />
                       </div>
                       <div>
                         <h1 className="text-2xl font-black text-[#064e3b] leading-tight">CER POLICLÍNICA</h1>
                         <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sistema de Gestão Multidisciplinar</p>
                       </div>
                     </div>
                     <div className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                       <p>Relatório de {reportOptions.find(r => r.id === selectedReport)?.title}</p>
                       <p className="text-[#064e3b]">Emitido em {new Date().toLocaleString()}</p>
                     </div>
                   </div>

                   {/* Report Metadata */}
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-8 px-6 bg-slate-50 rounded-[2rem]">
                     <div>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Responsável</p>
                       <p className="text-sm font-bold text-[#064e3b]">{currentUser.name}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Período</p>
                       <p className="text-sm font-bold text-[#064e3b]">{new Date(filters.startDate).toLocaleDateString()} - {new Date(filters.endDate).toLocaleDateString()}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Registros</p>
                       <p className="text-sm font-bold text-[#064e3b]">{dataFiltered.length} Itens</p>
                     </div>
                     <div className="flex items-center justify-end">
                        <div className="px-4 py-2 bg-emerald-100/50 rounded-xl flex items-center gap-2">
                          <Activity size={14} className="text-emerald-700" />
                          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Documento Válido</span>
                        </div>
                     </div>
                   </div>

                   {/* Summary Charts in Preview */}
                   <div className="grid grid-cols-2 gap-8">
                      <div className="border border-gray-100 p-6 rounded-2xl">
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Total por Município</p>
                         <div className="space-y-2">
                           {stats?.cityData.slice(0, 5).map(c => (
                             <div key={c.name} className="flex items-center justify-between">
                               <span className="text-xs font-bold text-gray-600">{c.name}</span>
                               <span className="text-xs font-black text-[#064e3b]">{c.value}</span>
                             </div>
                           ))}
                         </div>
                      </div>
                      <div className="border border-gray-100 p-6 rounded-2xl">
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Principais Diagnósticos</p>
                         <div className="space-y-2">
                           {stats?.diagnosisData.slice(0, 5).map(d => (
                             <div key={d.name} className="flex items-center justify-between">
                               <span className="text-xs font-bold text-gray-600 truncate max-w-[150px]">{d.name}</span>
                               <span className="text-xs font-black text-[#064e3b]">{d.value}</span>
                             </div>
                           ))}
                         </div>
                      </div>
                   </div>

                   {/* Table View */}
                   <div className="overflow-hidden border border-gray-100 rounded-3xl">
                     <table className="w-full text-left text-sm">
                       <thead>
                         <tr className="bg-slate-50 border-b border-gray-100">
                           <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Nome / Paciente</th>
                           <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Prontuário</th>
                           <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Município / Tipo</th>
                           <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Profissional</th>
                           <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Situação</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-50">
                         {dataFiltered.slice(0, 50).map((item: any, i) => (
                           <tr key={i}>
                             <td className="px-6 py-3 font-bold text-[#064e3b]">{item.name || item.patientName}</td>
                             <td className="px-6 py-3 font-medium text-gray-500">{item.medicalRecordNumber}</td>
                             <td className="px-6 py-3 font-medium text-gray-500">{item.city || item.type}</td>
                             <td className="px-6 py-3 font-medium text-emerald-800 text-[10px]">{item.responsibleProfessional || item.professionals?.[0] || '-'}</td>
                             <td className="px-6 py-3">
                               <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-100">
                                 {item.status || 'Registrado'}
                               </span>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                     {dataFiltered.length > 50 && (
                       <div className="p-4 text-center bg-gray-50 text-xs font-bold text-gray-400">
                         Mostrando primeiros 50 de {dataFiltered.length} registros. O PDF conterá a lista completa.
                       </div>
                     )}
                   </div>

                   {/* Signatures */}
                   <div className="grid grid-cols-2 gap-12 pt-12">
                      <div className="text-center pt-8 border-t border-gray-200">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Responsável pela Emissão</p>
                        <p className="text-sm font-black text-[#064e3b] mt-1">{currentUser.name}</p>
                      </div>
                      <div className="text-center pt-8 border-t border-gray-200">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Direção / Coordenação</p>
                        <div className="h-4 w-32 border-b border-gray-200 mx-auto mt-4"></div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="p-8 flex justify-end gap-3 bg-white border-t border-gray-100">
                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-8 py-3 rounded-xl border border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Fechar Visualização
                </button>
                <button 
                  onClick={exportPDF}
                  className="px-8 py-3 rounded-xl bg-[#064e3b] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10 transition-all active:scale-95"
                >
                  <Download size={18} /> Confirmar & Baixar PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
