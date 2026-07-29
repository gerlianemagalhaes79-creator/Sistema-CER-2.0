import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ClipboardList,
  CheckCircle2,
  X,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Diagnosis } from '../types';
import { DiagnosisService } from '../services/DiagnosisService';

export const DiagnosesPage = () => {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState<Diagnosis | null>(null);
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    const unsubscribe = DiagnosisService.subscribeToDiagnoses(setDiagnoses);
    return () => unsubscribe();
  }, []);

  const filteredDiagnoses = useMemo(() => {
    const searchNorm = search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return diagnoses.filter(d => {
      if (!searchNorm) return true;
      const nameNorm = (d.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nameNorm.includes(searchNorm);
    });
  }, [diagnoses, search]);

  const handleDelete = async (d: Diagnosis) => {
    if (window.confirm(`Tem certeza que deseja remover o diagnóstico "${d.name}"?`)) {
      try {
        await DiagnosisService.deleteDiagnosis(d.id);
      } catch (error) {
        console.error('Error deleting diagnosis:', error);
        alert('Erro ao remover diagnóstico.');
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#064e3b] tracking-tight">Cadastro de Diagnósticos</h2>
          <p className="text-sm font-medium text-gray-500">Gestão de diagnósticos padrões para os pacientes</p>
        </div>
        <button 
          onClick={() => { setEditingDiagnosis(null); setIsModalOpen(true); }}
          className="bg-[#064e3b] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10 transition-all active:scale-95"
        >
          <Plus size={20} />
          Novo Diagnóstico
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome do diagnóstico..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Diagnóstico</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDiagnoses.map(d => (
                <tr key={d.id} className="hover:bg-emerald-50/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-black border border-emerald-100">
                        <Activity size={20} />
                      </div>
                      <p className="text-sm font-bold text-gray-900">{d.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => { setEditingDiagnosis(d); setIsModalOpen(true); }}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(d)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDiagnoses.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-gray-400 font-medium italic">
                    Nenhum diagnóstico cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DiagnosisFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingDiagnosis={editingDiagnosis}
      />
    </motion.div>
  );
};

const DiagnosisFormModal = ({ isOpen, onClose, editingDiagnosis }: { isOpen: boolean, onClose: () => void, editingDiagnosis: Diagnosis | null }) => {
  const [formData, setFormData] = useState({
    name: '',
    status: 'Active' as const
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (editingDiagnosis) {
      setFormData({
        name: editingDiagnosis.name,
        status: editingDiagnosis.status
      });
    } else {
      setFormData({
        name: '',
        status: 'Active'
      });
    }
  }, [editingDiagnosis, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingDiagnosis) {
        await DiagnosisService.updateDiagnosis(editingDiagnosis.id, formData);
      } else {
        await DiagnosisService.addDiagnosis(formData);
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving diagnosis:', error);
      alert('Erro ao salvar diagnóstico.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#064e3b]/20 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-emerald-50"
          >
            <div className="p-8 pb-4 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-black text-[#064e3b] tracking-tight">{editingDiagnosis ? 'Editar Diagnóstico' : 'Novo Diagnóstico'}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cadastro Base</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Diagnóstico</label>
                  <div className="relative">
                    <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                      placeholder="Ex: TEA (Transtorno do Espectro Autista)"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 px-6 py-4 rounded-2xl border border-gray-100 font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#064e3b] text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-[#053d2e] shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      {editingDiagnosis ? 'Salvar Alterações' : 'Cadastrar'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
