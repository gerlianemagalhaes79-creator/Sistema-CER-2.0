import React, { useState, useMemo } from 'react';
import { 
  UserSquare2, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Shield, 
  Mail, 
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, AccessType } from '../types';
import { UserService } from '../services/UserService';

export const UsersPage = ({ currentUser, onReload }: { currentUser?: User | null, onReload: () => void }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<AccessType | ''>('');

  React.useEffect(() => {
    const unsubscribe = UserService.subscribeToUsers(setUsers);
    return () => unsubscribe();
  }, []);

  const filteredUsers = useMemo(() => {
    const searchNorm = search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return users.filter(u => {
      const nameNorm = (u.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const emailNorm = (u.email || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const matchSearch = !searchNorm || nameNorm.includes(searchNorm) || emailNorm.includes(searchNorm);
      const matchType = filterType ? u.accessType === filterType : true;
      return matchSearch && matchType;
    });
  }, [users, search, filterType]);

  const handleToggleStatus = async (u: User) => {
    const newStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await UserService.updateUser(u.id, { status: newStatus as any });
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Erro ao alterar status do usuário.');
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (currentUser && (currentUser.id === u.id || (currentUser.email && currentUser.email === u.email))) {
      alert('Você não pode apagar o seu próprio usuário enquanto estiver conectado com ele.');
      return;
    }
    if (window.confirm(`Tem certeza que deseja apagar o usuário ${u.name}? Esta ação não pode ser desfeita.`)) {
      try {
        await UserService.deleteUser(u.id);
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Erro ao apagar usuário.');
      }
    }
  };

  const refresh = () => {
    onReload();
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
          <h2 className="text-2xl font-black text-[#064e3b] tracking-tight">Gestão de Usuários</h2>
          <p className="text-sm font-medium text-gray-500">Controle de acesso e permissões do sistema</p>
        </div>
        <button 
          onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
          className="bg-[#064e3b] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10 transition-all active:scale-95"
        >
          <Plus size={20} />
          Novo Usuário
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium"
            />
          </div>
          
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium appearance-none"
            >
              <option value="">Todos os Tipos de Acesso</option>
              {Object.values(AccessType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Usuário</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">E-mail</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Cargo</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Acesso</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Senha</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-emerald-50/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#064e3b]/5 flex items-center justify-center text-[#064e3b] font-black border border-[#064e3b]/10">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-bold text-gray-900">{u.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-500">{u.email}</td>
                  <td className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">{u.role}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                      {u.accessType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono font-bold text-gray-400">
                    ••••••
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <button 
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                          u.status === 'Active' 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {u.status === 'Active' ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => { setEditingUser(u); setIsModalOpen(true); }}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                        title="Apagar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UserFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={refresh}
        editingUser={editingUser}
      />
    </motion.div>
  );
};

const UserFormModal = ({ isOpen, onClose, onSave, editingUser }: { isOpen: boolean, onClose: () => void, onSave: () => void, editingUser: User | null }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    accessType: AccessType.Profissional,
    status: 'Active' as const
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;

    if (editingUser) {
      setFormData({
        name: editingUser.name,
        email: editingUser.email,
        password: editingUser.password || '123',
        role: editingUser.role,
        accessType: editingUser.accessType,
        status: editingUser.status
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        role: '',
        accessType: AccessType.Profissional,
        status: 'Active'
      });
    }
  }, [editingUser, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUser) {
        await UserService.updateUser(editingUser.id, {
          name: formData.name,
          email: formData.email,
          password: formData.password || '123',
          role: formData.role,
          accessType: formData.accessType,
        });
      } else {
        await UserService.addUser({
          name: formData.name,
          email: formData.email,
          password: formData.password || '123',
          role: formData.role,
          accessType: formData.accessType,
          status: 'Active'
        });
      }
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving user:', error);
      alert(error.message || 'Erro ao salvar usuário.');
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
            className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-emerald-50"
          >
            <div className="p-8 pb-4 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-black text-[#064e3b] tracking-tight">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Informações de Acesso</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      placeholder="Ex: João Silva"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">E-mail Institucional</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                      placeholder="usuario@cer.com.br"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
                    <input 
                      type="text" 
                      required
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                      placeholder="Ex: 123456"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Cargo / Função</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
                    <input 
                      type="text" 
                      required
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                      placeholder="Ex: Médico, Recepcionista"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Tipo de Acesso</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
                    <select 
                      value={formData.accessType}
                      onChange={e => setFormData({...formData, accessType: e.target.value as AccessType})}
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b] appearance-none"
                    >
                      {Object.values(AccessType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
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
                      {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
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
