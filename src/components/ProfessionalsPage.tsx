import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  User as UserIcon,
  CheckCircle2,
  X,
  Stethoscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Professional } from '../types';
import { ProfessionalService } from '../services/ProfessionalService';

export const ProfessionalsPage = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    const unsubscribe = ProfessionalService.subscribeToProfessionals(setProfessionals);
    return () => unsubscribe();
  }, []);

  const filteredProfessionals = useMemo(() => {
    const searchNorm = search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return professionals.filter(p => {
      if (!searchNorm) return true;
      const nameNorm = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const areaNorm = (p.area || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nameNorm.includes(searchNorm) || areaNorm.includes(searchNorm);
    });
  }, [professionals, search]);

  const handleDelete = async (p: Professional) => {
    if (window.confirm(`Tem certeza que deseja remover ${p.name}?`)) {
      try {
        await ProfessionalService.deleteProfessional(p.id);
      } catch (error) {
        console.error('Error deleting professional:', error);
        alert('Erro ao remover profissional.');
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
          <h2 className="text-2xl font-black text-[#064e3b] tracking-tight">Equipe Multidisciplinar</h2>
          <p className="text-sm font-medium text-gray-500">Cadastro de profissionais e suas especialidades</p>
        </div>
        <button 
          onClick={() => { setEditingProfessional(null); setIsModalOpen(true); }}
          className="bg-[#064e3b] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10 transition-all active:scale-95"
        >
          <Plus size={20} />
          Novo Profissional
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou área..."
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
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Profissional</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Especialidade</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProfessionals.map(p => (
                <tr key={p.id} className="hover:bg-emerald-50/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-black border border-emerald-100">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-bold text-gray-900">{p.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-500">
                    <span className="flex items-center gap-2">
                       <Stethoscope size={14} className="text-emerald-600" />
                       {p.area}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => { setEditingProfessional(p); setIsModalOpen(true); }}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(p)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProfessionals.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-400 font-medium italic">
                    Nenhum profissional encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProfessionalFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProfessional={editingProfessional}
      />
    </motion.div>
  );
};

const ProfessionalFormModal = ({ isOpen, onClose, editingProfessional }: { isOpen: boolean, onClose: () => void, editingProfessional: Professional | null }) => {
  const [formData, setFormData] = useState({
    name: '',
    area: '',
    status: 'Active' as const
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;

    if (editingProfessional) {
      setFormData({
        name: editingProfessional.name,
        area: editingProfessional.area,
        status: editingProfessional.status
      });
    } else {
      setFormData({
        name: '',
        area: '',
        status: 'Active'
      });
    }
  }, [editingProfessional, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingProfessional) {
        await ProfessionalService.updateProfessional(editingProfessional.id, formData);
      } else {
        await ProfessionalService.addProfessional(formData);
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving professional:', error);
      alert('Erro ao salvar profissional.');
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
                <h3 className="text-2xl font-black text-[#064e3b] tracking-tight">{editingProfessional ? 'Editar Profissional' : 'Novo Profissional'}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Informações da Equipe</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                      placeholder="Ex: Nome do Profissional"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Especialidade</label>
                  <div className="relative">
                    <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
                    <input 
                      type="text" 
                      required
                      value={formData.area}
                      onChange={e => setFormData({...formData, area: e.target.value})}
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                      placeholder="Ex: Especialidade"
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
                      {editingProfessional ? 'Salvar Alterações' : 'Cadastrar'}
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
