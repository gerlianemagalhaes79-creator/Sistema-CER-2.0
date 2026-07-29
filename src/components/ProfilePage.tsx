import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Key, 
  CheckCircle2, 
  LogOut,
  Camera,
  Save,
  Lock,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';
import { UserService } from '../services/UserService';

export const ProfilePage = ({ user, onUpdate }: { user: User, onUpdate: (u: User) => void }) => {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const updated = await UserService.updateUser(user.id, formData);
      if (updated) {
        onUpdate(updated);
        setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao atualizar perfil.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (passwords.new !== passwords.confirm) {
      setMessage({ type: 'error', text: 'As novas senhas não coincidem.' });
      return;
    }
    
    try {
      const success = await UserService.changePassword(passwords.current, passwords.new);
      if (success) {
        setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        setMessage({ type: 'error', text: 'Ops! O Firebase pode exigir que você faça login novamente para mudar a senha por questões de segurança.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao alterar senha.' });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="bg-[#064e3b] p-8 rounded-[3rem] text-white relative overflow-hidden shadow-2xl shadow-emerald-900/20">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[2rem] bg-white/10 flex items-center justify-center text-5xl font-black border border-white/20 backdrop-blur-md shadow-inner">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <button className="absolute -bottom-2 -right-2 bg-emerald-500 p-2.5 rounded-2xl border-4 border-[#064e3b] shadow-lg hover:scale-110 transition-transform">
              <Camera size={18} />
            </button>
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-3xl font-black tracking-tight">{user.name}</h2>
            <p className="text-white/60 font-medium">{user.role}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
               <span className="bg-white/10 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-white/10">
                 ID: #{user.id.substring(0, 8)}
               </span>
               <span className="bg-emerald-500/20 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-500/30 text-emerald-100">
                 {user.accessType}
               </span>
            </div>
          </div>
        </div>
        
        {/* Background blobs */}
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-emerald-300/10 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Info */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserIcon size={20} />
            </div>
            <h3 className="text-lg font-black text-[#064e3b] tracking-tight">Dados do Perfil</h3>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nome de Exibição</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">E-mail de Contato</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-[#064e3b] text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-[#053d2e] shadow-xl shadow-emerald-900/10 transition-all flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Salvar Perfil
            </button>
          </form>
        </motion.div>

        {/* Security / Password */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
              <Lock size={20} />
            </div>
            <h3 className="text-lg font-black text-[#064e3b] tracking-tight">Alterar Senha</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Senha Atual</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  required
                  value={passwords.current}
                  onChange={e => setPasswords({...passwords, current: e.target.value})}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nova Senha</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  required
                  value={passwords.new}
                  onChange={e => setPasswords({...passwords, new: e.target.value})}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  required
                  value={passwords.confirm}
                  onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white outline-none transition-all font-bold text-[#064e3b]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-900/10 transition-all flex items-center justify-center gap-2"
            >
              <Lock size={18} />
              Atualizar Senha
            </button>
          </form>
        </motion.div>
      </div>
    </motion.div>
  );
};
