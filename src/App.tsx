import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  LayoutDashboard, 
  ClipboardList, 
  BarChart3, 
  UserSquare2, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Menu,
  Plus,
  Search,
  Filter,
  Edit,
  Eye,
  Trash2,
  X,
  Calendar,
  Stethoscope,
  MapPin,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Shield,
  Mail,
  Key,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Patient, PatientStatus, Movement, MovementType, CITIES, PROFESSIONALS, User, AccessType, Professional, Municipality, Diagnosis } from './types';
import { PatientService } from './services/PatientService';
import { MovementService } from './services/MovementService';
import { UserService } from './services/UserService';
import { ProfessionalService } from './services/ProfessionalService';
import { MunicipalityService } from './services/MunicipalityService';
import { DiagnosisService } from './services/DiagnosisService';
import { UsersPage } from './components/UsersPage';
import { ProfilePage } from './components/ProfilePage';
import { ReportsPage } from './components/ReportsPage';
import { ProfessionalsPage } from './components/ProfessionalsPage';
import { MunicipalitiesPage } from './components/MunicipalitiesPage';
import { DiagnosesPage } from './components/DiagnosesPage';
import { TrashPage } from './components/TrashPage';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area,
  Legend
} from 'recharts';

// --- Types ---
type Page = 'dashboard' | 'patients' | 'movements' | 'reports' | 'users' | 'profile' | 'professionals' | 'municipalities' | 'diagnoses' | 'trash';

// --- Helpers ---
export const normalizeStr = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

// --- UI Components ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  collapsed 
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void, 
  collapsed: boolean 
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-[#064e3b] text-white shadow-md' 
        : 'text-gray-600 hover:bg-gray-100 hover:text-[#064e3b]'
    }`}
    title={collapsed ? label : ''}
  >
    <Icon size={20} className="shrink-0" />
    {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
  </button>
);

const Card = ({ title, value, subtitle, icon: Icon, colorClass }: { title: string, value: string, subtitle?: string, icon?: any, colorClass?: string }) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
  >
    <div className="relative z-10">
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">{title}</h3>
      <p className={`text-3xl font-black ${colorClass || 'text-gray-900'} tracking-tighter`}>{value}</p>
      {subtitle && <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">{subtitle}</p>}
    </div>
    {Icon && (
      <Icon className={`absolute right-[-10px] bottom-[-10px] w-20 h-20 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${colorClass || 'text-gray-900'}`} />
    )}
  </motion.div>
);

const Header = ({ 
  user, 
  onLogout, 
  onProfile,
  sidebarCollapsed, 
  setSidebarCollapsed 
}: { 
  user: User, 
  onLogout: () => void,
  onProfile: () => void,
  sidebarCollapsed: boolean,
  setSidebarCollapsed: (v: boolean) => void
}) => (
  <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30">
    <div className="flex items-center gap-4">
      <button 
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 lg:hidden"
      >
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#064e3b] rounded-lg flex items-center justify-center lg:hidden">
          <UserSquare2 size={18} className="text-white" />
        </div>
        <h1 className="text-lg font-bold text-[#064e3b] hidden sm:block">CER Controle de Pacientes</h1>
        <h1 className="text-lg font-bold text-[#064e3b] sm:hidden">CER</h1>
      </div>
    </div>
    
    <div className="flex items-center gap-6">
      <button 
        onClick={onProfile}
        className="flex items-center gap-3 group transition-all"
      >
        <div className="text-right hidden md:block group-hover:opacity-80">
          <p className="text-sm font-bold text-gray-800 leading-tight">{user.name}</p>
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">{user.accessType}</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#064e3b] font-bold shadow-sm group-hover:shadow-md transition-shadow">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </button>
      <div className="h-8 w-px bg-gray-100"></div>
      <button 
        onClick={onLogout}
        className="flex items-center gap-2 p-2 px-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors font-semibold text-sm"
      >
        <LogOut size={18} />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </div>
  </header>
);

// --- Patient Modals & Components ---

const MultiSelect = ({ 
  label, 
  options, 
  selected, 
  onChange 
}: { 
  label: string, 
  options: string[], 
  selected: string[], 
  onChange: (val: string[]) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(o => o !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[44px] p-2 rounded-lg border border-gray-200 bg-white cursor-pointer flex flex-wrap gap-1 items-center"
      >
        {selected.length === 0 && <span className="text-gray-400 text-sm px-1">Selecione opções...</span>}
        {selected.map(item => (
          <span key={item} className="bg-emerald-50 text-[#064e3b] text-xs font-bold px-2 py-1 rounded flex items-center gap-1 border border-emerald-100">
            {item}
            <X size={12} onClick={(e) => { e.stopPropagation(); toggleOption(item); }} className="hover:text-red-500" />
          </span>
        ))}
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-xl shadow-xl p-2 grid grid-cols-1 gap-1">
            {options.map(option => (
              <button
                key={option}
                onClick={() => toggleOption(option)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selected.includes(option) 
                    ? 'bg-[#064e3b] text-white font-semibold' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const PatientFormModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingPatient,
  availableCities,
  availableProfessionals,
  availableDiagnoses,
  currentUser
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => void,
  editingPatient: Patient | null,
  availableCities: string[],
  availableProfessionals: string[],
  availableDiagnoses: string[],
  currentUser?: User | null
}) => {
  const [formData, setFormData] = useState<Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>({
    name: '',
    medicalRecordNumber: '',
    birthDate: '',
    gender: 'M',
    city: availableCities[0] || '',
    diagnoses: [],
    professionals: [],
    status: 'Ativo',
    entryDate: new Date().toISOString().split('T')[0],
    dischargeDate: '',
    observations: ''
  });

  useEffect(() => {
    if (editingPatient) {
      setFormData({
        name: editingPatient.name,
        medicalRecordNumber: editingPatient.medicalRecordNumber,
        birthDate: editingPatient.birthDate,
        gender: editingPatient.gender,
        city: editingPatient.city,
        diagnoses: editingPatient.diagnoses || [],
        professionals: editingPatient.professionals || [],
        status: editingPatient.status || 'Ativo',
        entryDate: editingPatient.entryDate || new Date().toISOString().split('T')[0],
        dischargeDate: editingPatient.dischargeDate || '',
        observations: editingPatient.observations || ''
      });
    } else {
      const defaultProfs: string[] = [];
      if (currentUser?.accessType === 'Profissional' && currentUser.name) {
        const cleanName = currentUser.name.split(' (')[0];
        if (cleanName) defaultProfs.push(cleanName);
      }

      setFormData({
        name: '',
        medicalRecordNumber: '',
        birthDate: '',
        gender: 'M',
        city: availableCities[0] || '',
        diagnoses: [],
        professionals: defaultProfs,
        status: 'Ativo',
        entryDate: new Date().toISOString().split('T')[0],
        dischargeDate: '',
        observations: ''
      });
    }
  }, [editingPatient, isOpen, availableCities, currentUser]);

  const age = useMemo(() => {
    if (!formData.birthDate) return '...';
    return PatientService.calculateAge(formData.birthDate);
  }, [formData.birthDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Por favor, digite o nome do paciente.');
      return;
    }

    const recNum = formData.medicalRecordNumber.trim() || `${new Date().getFullYear()}.${Math.floor(1000 + Math.random() * 9000)}`;
    const profs = [...formData.professionals];

    if (currentUser?.accessType === 'Profissional' && currentUser.name) {
      const cleanName = currentUser.name.split(' (')[0];
      if (cleanName && !profs.some(p => p.includes(cleanName))) {
        profs.push(cleanName);
      }
    }

    onSave({
      ...formData,
      name: formData.name.trim(),
      medicalRecordNumber: recNum,
      professionals: profs
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{editingPatient ? 'Editar Paciente' : 'Novo Paciente'}</h3>
            <p className="text-sm text-gray-500">Preencha as informações clínicas básicas</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Informações Básicas */}
            <div className="col-span-full border-b border-gray-100 pb-2 mb-2">
              <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
                <UserSquare2 size={14} /> Dados Pessoais
              </h4>
            </div>
            
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome Completo</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                placeholder="Ex: João da Silva Santos"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nº Prontuário</label>
              <input 
                type="text" 
                value={formData.medicalRecordNumber}
                onChange={e => setFormData({...formData, medicalRecordNumber: e.target.value})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                placeholder="Ex: 2024.001"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data Nasc.</label>
                <input 
                  type="date" 
                  value={formData.birthDate}
                  onChange={e => setFormData({...formData, birthDate: e.target.value})}
                  className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Idade</label>
                <div className="w-full p-3 rounded-lg border border-gray-100 bg-gray-50 text-gray-600 font-bold">
                  {age} anos
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sexo</label>
              <select 
                value={formData.gender}
                onChange={e => setFormData({...formData, gender: e.target.value as any})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              >
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Município</label>
              <select 
                value={formData.city}
                onChange={e => setFormData({...formData, city: e.target.value})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              >
                {!availableCities.length && <option value="">Nenhum município cadastrado</option>}
                {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Dados Clínicos */}
            <div className="col-span-full border-b border-gray-100 pb-2 mt-4 mb-2">
              <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
                <Stethoscope size={14} /> Informações Clínicas
              </h4>
            </div>

            <div className="lg:col-span-2">
              <MultiSelect 
                label="Diagnósticos" 
                options={availableDiagnoses} 
                selected={formData.diagnoses} 
                onChange={val => setFormData({...formData, diagnoses: val})} 
              />
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Situação</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as PatientStatus})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              >
                <option value="Ativo">Ativo</option>
                <option value="Alta">Alta</option>
                <option value="Investigação">Investigação</option>
                <option value="Espera">Espera</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <MultiSelect 
                label="Profissionais Responsáveis" 
                options={availableProfessionals} 
                selected={formData.professionals} 
                onChange={val => setFormData({...formData, professionals: val})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4 lg:col-span-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data Entrada</label>
                <input 
                  type="date" 
                  value={formData.entryDate}
                  onChange={e => setFormData({...formData, entryDate: e.target.value})}
                  className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                />
              </div>
              <div>
                <label className={`block text-sm font-semibold text-gray-700 mb-1.5 ${formData.status !== 'Alta' ? 'opacity-30' : ''}`}>Data Alta</label>
                <input 
                  type="date" 
                  disabled={formData.status !== 'Alta'}
                  value={formData.dischargeDate}
                  onChange={e => setFormData({...formData, dischargeDate: e.target.value})}
                  className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Observações Adicionais</label>
              <textarea 
                value={formData.observations}
                onChange={e => setFormData({...formData, observations: e.target.value})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none min-h-[80px]"
                placeholder="Informações relevantes sobre o tratamento, convênios ou restrições..."
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-bold text-gray-500 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            className="px-8 py-2.5 rounded-lg font-bold bg-[#064e3b] text-white hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10 transition-all cursor-pointer"
          >
            {editingPatient ? 'Salvar Alterações' : 'Cadastrar Paciente'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: PatientStatus }) => {
  const styles = {
    Ativo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Alta: 'bg-blue-100 text-blue-800 border-blue-200',
    Investigação: 'bg-amber-100 text-amber-800 border-amber-200',
    Espera: 'bg-gray-100 text-gray-600 border-gray-200'
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
};

const MovementTypeBadge = ({ type }: { type: MovementType }) => {
  const styles = {
    'Entrada': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Alta': 'bg-blue-100 text-blue-800 border-blue-200',
    'Transferência': 'bg-purple-100 text-purple-800 border-purple-200',
    'Mudança de profissional': 'bg-amber-100 text-amber-800 border-amber-200',
    'Atualização cadastral': 'bg-gray-100 text-gray-600 border-gray-200',
    'Atendimento': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Absenteísmo': 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight border ${styles[type]}`}>
      {type}
    </span>
  );
};

const MovementFormModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  patients,
  availableProfessionals,
  editingMovement
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (movement: Omit<Movement, 'id' | 'createdAt' | 'deletedAt'>) => void,
  patients: Patient[],
  availableProfessionals: string[],
  editingMovement: Movement | null
}) => {
  const [formData, setFormData] = useState<Omit<Movement, 'id' | 'createdAt' | 'deletedAt'>>({
    patientId: '',
    patientName: '',
    medicalRecordNumber: '',
    diagnoses: [],
    professionals: [],
    responsibleProfessional: '',
    type: 'Atendimento',
    date: new Date().toISOString().split('T')[0],
    observations: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientList, setShowPatientList] = useState(false);

  useEffect(() => {
    if (editingMovement) {
      setFormData({
        patientId: editingMovement.patientId,
        patientName: editingMovement.patientName,
        medicalRecordNumber: editingMovement.medicalRecordNumber,
        diagnoses: editingMovement.diagnoses,
        professionals: editingMovement.professionals,
        responsibleProfessional: editingMovement.responsibleProfessional || '',
        type: editingMovement.type,
        date: editingMovement.date,
        observations: editingMovement.observations || ''
      });
      setSearchTerm(editingMovement.patientName);
    } else {
      setFormData({
        patientId: '',
        patientName: '',
        medicalRecordNumber: '',
        diagnoses: [],
        professionals: [],
        responsibleProfessional: '',
        type: 'Atendimento',
        date: new Date().toISOString().split('T')[0],
        observations: ''
      });
      setSearchTerm('');
    }
  }, [editingMovement, isOpen]);

  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = normalizeStr(searchTerm.trim().replace(/^#/, ''));
    return patients.filter(p => {
      const nameNorm = normalizeStr(p.name);
      const recordNorm = normalizeStr(p.medicalRecordNumber);
      return nameNorm.includes(term) || recordNorm.includes(term);
    }).slice(0, 8);
  }, [patients, searchTerm]);

  const selectPatient = (p: Patient) => {
    setFormData({
      ...formData,
      patientId: p.id,
      patientName: p.name,
      medicalRecordNumber: p.medicalRecordNumber,
      diagnoses: p.diagnoses,
      professionals: p.professionals,
      responsibleProfessional: p.professionals[0] || ''
    });
    setSearchTerm(p.name);
    setShowPatientList(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Nova Movimentação</h3>
            <p className="text-sm text-gray-500">Registre entradas, altas ou mudanças clínicas</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Patient Selection */}
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Buscar Paciente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowPatientList(true);
                  if (!e.target.value) setFormData({...formData, patientId: ''});
                }}
                onFocus={() => setShowPatientList(true)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                placeholder="Digite o nome ou prontuário..."
              />
            </div>
            
            {showPatientList && filteredPatients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                {filteredPatients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-gray-50 last:border-none flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-bold text-[#064e3b] text-sm">{p.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">#{p.medicalRecordNumber} • {p.city}</p>
                    </div>
                    <Plus size={16} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auto-filled Preview */}
          {formData.patientId && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100/50 grid grid-cols-2 gap-4"
            >
              <div>
                <p className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">Diagnóstico(s)</p>
                <div className="flex flex-wrap gap-1">
                   {formData.diagnoses.map(d => (
                     <span key={d} className="bg-white/60 px-2 py-0.5 rounded text-[10px] font-bold text-gray-600 border border-emerald-100">{d}</span>
                   ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">Equipe</p>
                <p className="text-[10px] font-bold text-gray-600 truncate">{formData.professionals.join(', ') || 'Nenhum'}</p>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo de Movimentação</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as MovementType})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              >
                <option value="Atendimento">Atendimento</option>
                <option value="Entrada">Entrada</option>
                <option value="Alta">Alta</option>
                <option value="Transferência">Transferência</option>
                <option value="Mudança de profissional">Mudança de profissional</option>
                <option value="Atualização cadastral">Atualização cadastral</option>
                <option value="Absenteísmo">Absenteísmo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Profissional Responsável</label>
              <select 
                value={formData.responsibleProfessional}
                onChange={e => setFormData({...formData, responsibleProfessional: e.target.value})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              >
                <option value="">Selecione o profissional...</option>
                {availableProfessionals.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data da Ocorrência</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Observações Detalhadas</label>
            <textarea 
              value={formData.observations}
              onChange={e => setFormData({...formData, observations: e.target.value})}
              className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none min-h-[100px]"
              placeholder="Descreva o motivo da movimentação ou detalhes importantes..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg font-bold text-gray-500 hover:bg-gray-200 transition-colors">Cancelar</button>
          <button 
            disabled={!formData.patientId}
            onClick={() => onSave(formData)}
            className="px-8 py-2.5 rounded-lg font-bold bg-[#064e3b] text-white hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editingMovement ? 'Salvar Alterações' : 'Registrar Movimentação'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Pages ---

const DashboardPage = ({ 
  patients, 
  movements,
  availableCities,
  availableProfessionals,
  availableDiagnoses
}: { 
  patients: Patient[], 
  movements: Movement[],
  availableCities: string[],
  availableProfessionals: string[],
  availableDiagnoses: string[],
  key?: string 
}) => {
  const [filterCity, setFilterCity] = useState('');
  const [filterProfessional, setFilterProfessional] = useState('');
  const [filterDiagnosis, setFilterDiagnosis] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7));

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchCity = filterCity ? p.city === filterCity : true;
      const matchPro = filterProfessional ? p.professionals.includes(filterProfessional) : true;
      const matchDiag = filterDiagnosis ? p.diagnoses?.includes(filterDiagnosis) : true;
      return matchCity && matchPro && matchDiag;
    });
  }, [patients, filterCity, filterProfessional, filterDiagnosis]);

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const matchPro = filterProfessional 
        ? (m.responsibleProfessional?.includes(filterProfessional) || m.professionals.includes(filterProfessional)) 
        : true;
      const matchMonth = filterMonth ? m.date.startsWith(filterMonth) : true;
      return matchPro && matchMonth;
    });
  }, [movements, filterProfessional, filterMonth]);

  const stats = useMemo(() => {
    const total = filteredPatients.length;
    const active = filteredPatients.filter(p => p.status === 'Ativo').length;
    const investigation = filteredPatients.filter(p => p.status === 'Investigação').length;
    const waiting = filteredPatients.filter(p => p.status === 'Espera').length;
    const monthlyDischarges = filteredMovements.filter(m => m.type === 'Alta').length;

    const targetMonth = filterMonth || new Date().toISOString().substring(0, 7);
    const entryMovements = filteredMovements.filter(m => m.type === 'Entrada');
    const entryPatientIds = new Set(entryMovements.map(m => m.patientId));

    const fallbackPatients = filteredPatients.filter(p => {
      if (entryPatientIds.has(p.id)) return false;
      const pDate = p.entryDate || p.createdAt?.substring(0, 10) || '';
      return pDate.startsWith(targetMonth);
    });

    const monthlyEntries = entryMovements.length + fallbackPatients.length;
    const monthlyAbsentees = filteredMovements.filter(m => m.type === 'Absenteísmo').length;
    const absentees = filteredPatients.filter(p => (p.absenteeismCount || 0) > 0).length;

    return { total, active, investigation, waiting, monthlyDischarges, monthlyEntries, absentees, monthlyAbsentees };
  }, [filteredPatients, filteredMovements, filterMonth]);

  // Data for Charts
  const diagnosisData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPatients.forEach(p => {
      p.diagnoses.forEach(d => {
        counts[d] = (counts[d] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredPatients]);

  const cityData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPatients.forEach(p => {
      counts[p.city] = (counts[p.city] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredPatients]);

  const professionalData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPatients.forEach(p => {
      p.professionals.forEach(pro => {
        const name = pro.split(' (')[0];
        counts[name] = (counts[name] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredPatients]);

  const trendData = useMemo(() => {
    // Last 6 months
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().substring(0, 7);

      const entryMovements = movements.filter(m => m.type === 'Entrada' && m.date.startsWith(monthStr));
      const entryPatientIds = new Set(entryMovements.map(m => m.patientId));

      const fallbackPatients = patients.filter(p => {
        if (entryPatientIds.has(p.id)) return false;
        const pDate = p.entryDate || p.createdAt?.substring(0, 10) || '';
        return pDate.startsWith(monthStr);
      });

      const entriesCount = entryMovements.length + fallbackPatients.length;

      const dischargeMovements = movements.filter(m => m.type === 'Alta' && m.date.startsWith(monthStr));
      const dischargePatientIds = new Set(dischargeMovements.map(m => m.patientId));
      const fallbackDischarges = patients.filter(p => {
        if (dischargePatientIds.has(p.id)) return false;
        if (p.status !== 'Alta') return false;
        const dDate = p.dischargeDate || p.updatedAt?.substring(0, 10) || '';
        return dDate.startsWith(monthStr);
      });

      const dischargesCount = dischargeMovements.length + fallbackDischarges.length;

      data.push({
        name: d.toLocaleDateString('pt-BR', { month: 'short' }),
        entradas: entriesCount,
        altas: dischargesCount
      });
    }
    return data;
  }, [movements, patients]);

  const PIE_COLORS = ['#064e3b', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-[#064e3b] tracking-tight">Painel de Controle</h2>
          <p className="text-sm font-semibold text-gray-400 mt-1 uppercase tracking-widest">Inteligência Clínica e Gerencial</p>
        </div>
        
        <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 border-r border-gray-100 last:border-none">
            <Calendar size={14} className="text-emerald-600" />
            <input 
              type="month" 
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="text-xs font-bold text-gray-600 outline-none bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2 px-3 border-r border-gray-100 last:border-none">
            <MapPin size={14} className="text-emerald-600" />
            <select 
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="text-xs font-bold text-gray-600 outline-none bg-transparent"
            >
              <option value="">Todos Municípios</option>
              {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 px-3 border-r border-gray-100 last:border-none">
            <ClipboardList size={14} className="text-emerald-600" />
            <select 
              value={filterDiagnosis}
              onChange={e => setFilterDiagnosis(e.target.value)}
              className="text-xs font-bold text-gray-600 outline-none bg-transparent max-w-[150px]"
            >
              <option value="">Todos Diagnósticos</option>
              {availableDiagnoses.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 px-3">
            <Stethoscope size={14} className="text-emerald-600" />
            <select 
              value={filterProfessional}
              onChange={e => setFilterProfessional(e.target.value)}
              className="text-xs font-bold text-gray-600 outline-none bg-transparent max-w-[150px]"
            >
              <option value="">Equipe Multidisciplinar</option>
              {availableProfessionals.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <Card title="Total Geral" value={stats.total.toString()} subtitle="Pacientes Base" icon={Users} />
        <Card title="Ativos" value={stats.active.toString()} subtitle="Em Tratamento" colorClass="text-emerald-600" icon={Activity} />
        <Card title="Investigação" value={stats.investigation.toString()} subtitle="Triagem Inicial" colorClass="text-amber-500" icon={Search} />
        <Card title="Em Espera" value={stats.waiting.toString()} subtitle="Fila de Acesso" colorClass="text-blue-500" icon={Clock} />
        <Card title="Pacientes c/ Falta" value={stats.absentees.toString()} subtitle="Base de Absenteísmo" colorClass="text-red-600" icon={AlertCircle} />
        <Card title="Faltas no Mês" value={stats.monthlyAbsentees.toString()} subtitle="Total Absenteísmo" colorClass="text-orange-600" icon={AlertCircle} />
        <Card title="Altas no Mês" value={stats.monthlyDischarges.toString()} subtitle="Ciclo Completo" colorClass="text-rose-600" icon={ArrowUpRight} />
        <Card title="Entradas no Mês" value={stats.monthlyEntries.toString()} subtitle="Novas Admissões" colorClass="text-indigo-600" icon={ArrowDownRight} />
      </div>

      {/* Grid of Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trend Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
               <ArrowUpRight size={16} className="text-emerald-600" /> Fluxo de Atendimento (Semestral)
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#064e3b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#064e3b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAltas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px' }}
                />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="entradas" stroke="#064e3b" strokeWidth={3} fillOpacity={1} fill="url(#colorEntradas)" />
                <Area type="monotone" dataKey="altas" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorAltas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Diagnosis Distribution */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
        >
          <div className="mb-8">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
               <Stethoscope size={16} className="text-emerald-600" /> Pacientes por Diagnóstico
            </h3>
          </div>
          <div className="h-[300px] w-full flex items-center justify-center">
            {diagnosisData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={diagnosisData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={100}
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {diagnosisData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip />
                 <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
               </PieChart>
             </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-300">
                <p className="text-sm font-bold">Sem dados para exibir</p>
                <p className="text-xs">Cadastre pacientes para ver estatísticas</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* City Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
        >
          <div className="mb-8">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
               <MapPin size={16} className="text-emerald-600" /> Distribuição por Município
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} width={100} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar dataKey="value" fill="#064e3b" radius={[0, 10, 10, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Professional Capacity */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
        >
          <div className="mb-8">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
               <UserSquare2 size={16} className="text-emerald-600" /> Pacientes por Profissional
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={professionalData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar dataKey="value" fill="#10b981" radius={[10, 10, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity Lists */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Recent Patients */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-[#064e3b] tracking-tight uppercase text-xs flex items-center gap-2">
              <Plus size={14} /> Adicionados Recentemente
            </h3>
            <button className="text-[10px] font-black text-emerald-600 uppercase hover:underline">Ver Todos</button>
          </div>
          <div className="space-y-4">
            {patients.slice(-5).reverse().map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-emerald-50/20 transition-all border border-transparent hover:border-emerald-50 group">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-[#064e3b] font-black group-hover:bg-white group-hover:shadow-sm">
                  {p.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">#{p.medicalRecordNumber} • {p.city}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
            {patients.length === 0 && (
               <div className="py-10 text-center text-gray-300">
                  <Users size={32} className="mx-auto mb-2 opacity-10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Sem registros recentes</p>
               </div>
            )}
          </div>
        </motion.div>

        {/* Latest Movements */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-[#064e3b] tracking-tight uppercase text-xs flex items-center gap-2">
              <Clock size={14} /> Últimas Movimentações
            </h3>
            <button className="text-[10px] font-black text-emerald-600 uppercase hover:underline">Histórico Completo</button>
          </div>
          <div className="space-y-4">
            {movements.slice(-5).reverse().map(m => (
              <div key={m.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-blue-50/20 transition-all border border-transparent hover:border-blue-50">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                  <MovementTypeBadge type={m.type} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{m.patientName}</p>
                  <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                     <span>{new Date(m.date).toLocaleDateString('pt-BR')}</span>
                     <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                     <span>{m.type}</span>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-bold text-gray-400">{new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {movements.length === 0 && (
               <div className="py-10 text-center text-gray-300">
                  <ClipboardList size={32} className="mx-auto mb-2 opacity-10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Sem movimentos registrados</p>
               </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

const PatientsPage = ({ 
  patients, 
  currentUser,
  availableCities,
  availableProfessionals,
  availableDiagnoses,
  onReload 
}: { 
  patients: Patient[], 
  currentUser: User,
  availableCities: string[],
  availableProfessionals: string[],
  availableDiagnoses: string[],
  onReload: () => void, 
  key?: string 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterProfessional, setFilterProfessional] = useState('');
  const [filterStatus, setFilterStatus] = useState<PatientStatus | ''>('');
  const [showOnlyAbsentees, setShowOnlyAbsentees] = useState(false);

  const canEdit = currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação' || currentUser.accessType === 'Recepção' || currentUser.accessType === 'Profissional';
  const canDelete = currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação' || currentUser.accessType === 'Recepção';

  const filteredPatients = useMemo(() => {
    const searchNorm = normalizeStr(search.trim().replace(/^#/, ''));

    return patients.filter(p => {
      // Permission filtering: Professionals see their linked patients, unassigned patients, or patients they created
      if (currentUser.accessType === 'Profissional') {
        const nameClean = normalizeStr(currentUser.name.split(' (')[0]);
        const isLinked = (p.professionals || []).some(pro => normalizeStr(pro).includes(nameClean));
        const isUnassigned = (!p.professionals || p.professionals.length === 0);
        const isCreator = p.updatedBy === currentUser.email;
        if (!isLinked && !isUnassigned && !isCreator) return false;
      }

      if (searchNorm) {
        const nameNorm = normalizeStr(p.name);
        const recordNorm = normalizeStr(p.medicalRecordNumber);
        const cityNorm = normalizeStr(p.city);
        const diagnosesNorm = (p.diagnoses || []).map(d => normalizeStr(d)).join(' ');
        const profsNorm = (p.professionals || []).map(pro => normalizeStr(pro)).join(' ');
        const obsNorm = normalizeStr(p.observations);

        const matchSearch =
          nameNorm.includes(searchNorm) ||
          recordNorm.includes(searchNorm) ||
          cityNorm.includes(searchNorm) ||
          diagnosesNorm.includes(searchNorm) ||
          profsNorm.includes(searchNorm) ||
          obsNorm.includes(searchNorm);

        if (!matchSearch) return false;
      }

      if (filterCity) {
        if (p.city !== filterCity) return false;
      }

      if (filterProfessional) {
        const isProfMatch = (p.professionals || []).some(
          pro => normalizeStr(pro).includes(normalizeStr(filterProfessional))
        );
        if (!isProfMatch) return false;
      }

      if (filterStatus) {
        if (p.status !== filterStatus) return false;
      }

      if (showOnlyAbsentees) {
        if ((p.absenteeismCount || 0) <= 0) return false;
      }

      return true;
    });
  }, [patients, search, filterCity, filterProfessional, filterStatus, showOnlyAbsentees, currentUser]);

  const handleSave = async (data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingPatient) {
        await PatientService.updatePatient(editingPatient.id, data);
      } else {
        await PatientService.addPatient(data);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving patient:', error);
      alert('Erro ao salvar paciente. Verifique as permissões.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Deseja realmente enviar este paciente para a lixeira? (Você poderá restaurá-lo na Lixeira em até 5 dias)')) {
      try {
        await PatientService.softDeletePatient(id);
      } catch (error: any) {
        console.error('Error deleting patient:', error);
        let msg = 'Erro ao excluir paciente.';
        try {
          const errData = JSON.parse(error.message);
          if (errData.error.includes('permission')) {
            msg += ' Permissão insuficiente.';
          }
        } catch (e) {}
        alert(msg);
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
          <h2 className="text-2xl font-black text-[#064e3b] tracking-tight">Pacientes</h2>
          <p className="text-sm font-medium text-gray-500">Gestão centralizada do cadastro de pacientes</p>
        </div>
        {canEdit && (
          <button 
            onClick={() => { setEditingPatient(null); setIsModalOpen(true); }}
            className="bg-[#064e3b] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10 transition-all active:scale-95"
          >
            <Plus size={20} />
            Novo Paciente
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome, prontuário, diagnóstico..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium appearance-none"
            >
              <option value="">Todos os Municípios</option>
              {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="relative">
            <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={filterProfessional}
              onChange={e => setFilterProfessional(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium appearance-none"
            >
              <option value="">Equipe Multidisciplinar</option>
              {availableProfessionals.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium appearance-none"
            >
              <option value="">Todas as Situações</option>
              <option value="Ativo">Ativo</option>
              <option value="Alta">Alta</option>
              <option value="Investigação">Investigação</option>
              <option value="Espera">Espera</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-2">
           <label className="flex items-center gap-2 cursor-pointer group">
             <input 
               type="checkbox"
               className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
               checked={showOnlyAbsentees}
               onChange={e => setShowOnlyAbsentees(e.target.checked)}
             />
             <span className="text-xs font-bold text-gray-500 group-hover:text-emerald-700 transition-colors">Ver apenas pacientes com absenteísmo</span>
           </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Prontuário</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Paciente</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Idade</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Diagnóstico Principal</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Resp. Técnico</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                    <Users size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="font-bold">Nenhum paciente encontrado</p>
                    <p className="text-xs">Tente ajustar seus filtros ou cadastrar um novo paciente</p>
                  </td>
                </tr>
              ) : (
                filteredPatients.map(p => (
                  <tr key={p.id} className="hover:bg-emerald-50/20 transition-colors group">
                    <td className="px-6 py-4 text-sm font-black text-emerald-700 tracking-tighter">#{p.medicalRecordNumber}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-none mb-1">{p.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-black">{p.city}</p>
                        </div>
                        {p.absenteeismCount && p.absenteeismCount > 0 && (
                          <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter shadow-sm border ${p.absenteeismCount >= 3 ? 'bg-red-500 text-white border-red-600 animate-bounce' : 'bg-amber-100 text-amber-800 border-amber-200'}`} title={`${p.absenteeismCount} absenteísmos`}>
                            {p.absenteeismCount} ABS
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-600">{PatientService.calculateAge(p.birthDate)} anos</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {p.diagnoses.slice(0, 1).map(d => (
                          <span key={d} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">
                            {d}
                          </span>
                        ))}
                        {p.diagnoses.length > 1 && (
                          <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold">
                            +{p.diagnoses.length - 1}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-bold text-gray-500">
                        {p.professionals[0]?.split('(')[0] || 'Nenhum'}
                      </div>
                      {p.updatedBy && (
                        <p className="text-[8px] text-gray-300 font-medium italic mt-1">
                          Ref: {p.updatedBy.split('@')[0]}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Visualizar">
                          <Eye size={16} />
                        </button>
                        {canEdit && (
                          <button 
                            onClick={() => { setEditingPatient(p); setIsModalOpen(true); }}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(p.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Listando {filteredPatients.length} de {patients.length} pacientes</p>
        </div>
      </div>

      <PatientFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave} 
        editingPatient={editingPatient}
        availableCities={availableCities}
        availableProfessionals={availableProfessionals}
        availableDiagnoses={availableDiagnoses}
        currentUser={currentUser}
      />
    </motion.div>
  );
};

const MovementsPage = ({ 
  movements, 
  patients, 
  currentUser,
  availableProfessionals,
  onReload 
}: { 
  movements: Movement[], 
  patients: Patient[], 
  currentUser: User,
  availableProfessionals: string[],
  onReload: () => void, 
  key?: string 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<MovementType | ''>('');
  const [filterProfessional, setFilterProfessional] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  const canCreate = currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação' || currentUser.accessType === 'Recepção';
  const canEdit = currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação' || currentUser.accessType === 'Recepção';
  const canDelete = currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação' || currentUser.accessType === 'Recepção';

  const filteredMovements = useMemo(() => {
    const searchNorm = normalizeStr(search.trim().replace(/^#/, ''));

    return movements
      .filter(m => {
        // Permission filtering: Professionals only see movements of their patients
        if (currentUser.accessType === 'Profissional') {
          const nameClean = normalizeStr(currentUser.name.split(' (')[0]);
          const isLinked = (m.professionals || []).some(pro => normalizeStr(pro).includes(nameClean));
          if (!isLinked) return false;
        }

        if (searchNorm) {
          const nameNorm = normalizeStr(m.patientName);
          const recordNorm = normalizeStr(m.medicalRecordNumber);
          const typeNorm = normalizeStr(m.type);
          const obsNorm = normalizeStr(m.observations);
          const profsNorm = (m.professionals || []).map(p => normalizeStr(p)).join(' ');

          const matchSearch =
            nameNorm.includes(searchNorm) ||
            recordNorm.includes(searchNorm) ||
            typeNorm.includes(searchNorm) ||
            obsNorm.includes(searchNorm) ||
            profsNorm.includes(searchNorm);

          if (!matchSearch) return false;
        }

        const matchType = filterType ? m.type === filterType : true;
        const matchPro = filterProfessional ? (m.professionals || []).some(pro => normalizeStr(pro).includes(normalizeStr(filterProfessional))) : true;
        const matchMonth = filterMonth ? m.date.startsWith(filterMonth) : true;
        return matchType && matchPro && matchMonth;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, search, filterType, filterProfessional, filterMonth, currentUser]);

  const stats = useMemo(() => {
    const currentMonth = filteredMovements;
    const entries = currentMonth.filter(m => m.type === 'Entrada').length;
    const discharges = currentMonth.filter(m => m.type === 'Alta').length;
    const absentees = currentMonth.filter(m => m.type === 'Absenteísmo').length;
    const activePatients = patients.filter(p => p.status === 'Ativo').length;
    return { entries, discharges, activePatients, absentees, total: currentMonth.length };
  }, [filteredMovements, patients]);

  const handleSave = async (data: Omit<Movement, 'id' | 'createdAt' | 'deletedAt'>) => {
    try {
      const patient = patients.find(p => p.id === data.patientId);
      
      if (editingMovement) {
        // Logica para ajuste de contador de absenteísmo se o tipo mudar
        if (patient && editingMovement.type !== data.type) {
          let newCount = patient.absenteeismCount || 0;
          if (editingMovement.type === 'Absenteísmo') newCount--;
          if (data.type === 'Absenteísmo') newCount++;
          
          await PatientService.updatePatient(patient.id, { 
            absenteeismCount: Math.max(0, newCount)
          });
        }
        await MovementService.updateMovement(editingMovement.id, data);
      } else {
        await MovementService.addMovement(data);
        
        // Se for um novo absenteísmo, incrementa o contador
        if (data.type === 'Absenteísmo' && patient) {
          const newCount = (patient.absenteeismCount || 0) + 1;
          const updates: Partial<Patient> = { absenteeismCount: newCount };
          
          if (newCount >= 3) {
            alert(`ATENÇÃO: O paciente ${patient.name} atingiu 3 absenteísmos e perderá a vaga (status alterado para Alta).`);
            updates.status = 'Alta';
          }
          
          await PatientService.updatePatient(patient.id, updates);
        }
      }

      // Se for uma movimentação de ALTA, atualiza o status do paciente
      if (data.type === 'Alta') {
        if (patient) {
          await PatientService.updatePatient(patient.id, { 
            status: 'Alta',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email
          });
        }
      } 
      // Se for uma ENTRADA, garante que o paciente esteja ATIVO
      else if (data.type === 'Entrada') {
        if (patient) {
          await PatientService.updatePatient(patient.id, { 
            status: 'Ativo',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email
          });
        }
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving movement:', error);
      alert('Erro ao registrar movimentação.');
    }
  };

  const handleDelete = async (id: string) => {
    const movement = movements.find(m => m.id === id);
    if (!movement) return;

    if (window.confirm('Deseja realmente enviar esta movimentação para a lixeira?')) {
      try {
        await MovementService.softDeleteMovement(id);
        
        const patient = patients.find(p => p.id === movement.patientId);
        
        // Se a movimentação sendo apagada for de ALTA, o paciente deve voltar para ATIVO
        if (movement.type === 'Alta' && patient) {
          await PatientService.updatePatient(patient.id, { 
            status: 'Ativo',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email
          });
        }

        // Se apagar um absenteísmo, decrementa o contador
        if (movement.type === 'Absenteísmo' && patient) {
          const newCount = Math.max(0, (patient.absenteeismCount || 0) - 1);
          await PatientService.updatePatient(patient.id, { 
            absenteeismCount: newCount
          });
        }
      } catch (error: any) {
        console.error('Error deleting movement:', error);
        let msg = 'Erro ao excluir movimentação.';
        try {
          const errData = JSON.parse(error.message);
          if (errData.error.includes('permission')) {
            msg += ' Permissão insuficiente.';
          }
        } catch (e) {}
        alert(msg);
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
          <h2 className="text-2xl font-black text-[#064e3b] tracking-tight">Movimentações</h2>
          <p className="text-sm font-medium text-gray-500">Controle mensal de entradas, altas e fluxos</p>
        </div>
        {canCreate && (
          <button 
            onClick={() => { setEditingMovement(null); setIsModalOpen(true); }}
            className="bg-[#064e3b] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10 transition-all active:scale-95"
          >
            <Plus size={20} />
            Nova Movimentação
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card title="Entradas no Mês" value={stats.entries.toString()} subtitle="Novos pacientes" icon={Plus} />
        <Card title="Altas no Mês" value={stats.discharges.toString()} subtitle="Ciclos finalizados" icon={ClipboardList} />
        <Card title="Faltas no Mês" value={stats.absentees.toString()} subtitle="Total absenteísmo" colorClass="text-red-600" icon={AlertCircle} />
        <Card title="Pacientes Ativos" value={stats.activePatients.toString()} subtitle="Base atual" icon={Users} />
        <Card title="Total Movimentos" value={stats.total.toString()} subtitle="No período" icon={Clock} />
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Nome ou prontuário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="month" 
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium"
            />
          </div>

          <div className="relative">
            <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={filterProfessional}
              onChange={e => setFilterProfessional(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium appearance-none"
            >
              <option value="">Todos Profissionais</option>
              {availableProfessionals.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm font-medium appearance-none"
            >
              <option value="">Todos os Tipos</option>
              <option value="Atendimento">Atendimento</option>
              <option value="Entrada">Entrada</option>
              <option value="Alta">Alta</option>
              <option value="Transferência">Transferência</option>
              <option value="Mudança de profissional">Mudança de profissional</option>
              <option value="Atualização cadastral">Atualização cadastral</option>
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
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Tipo</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Paciente</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Diagnóstico</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Resp. Técnico</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Observação</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                    <ClipboardList size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="font-bold">Nenhuma movimentação no período</p>
                    <p className="text-xs">Registre uma nova ocorrência clicando no botão acima</p>
                  </td>
                </tr>
              ) : (
                filteredMovements.map(m => (
                  <tr key={m.id} className="hover:bg-emerald-50/20 transition-colors group">
                    <td className="px-6 py-4">
                       <p className="text-xs font-bold text-gray-500">{new Date(m.date).toLocaleDateString('pt-BR')}</p>
                       <p className="text-[9px] font-medium text-gray-400">{new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <MovementTypeBadge type={m.type} />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900 leading-none mb-1">{m.patientName}</p>
                        <p className="text-[10px] text-emerald-700 font-black">#{m.medicalRecordNumber}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {m.diagnoses.map(d => (
                          <span key={d} className="bg-gray-50 text-gray-500 px-2 py-0.5 rounded text-[9px] font-bold border border-gray-100">
                             {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-[10px] font-bold text-[#064e3b]">{m.responsibleProfessional || '-'}</p>
                       <p className="text-[9px] text-gray-400">Equipe original: {m.professionals.join(', ') || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-xs text-gray-500 max-w-[200px] truncate" title={m.observations}>{m.observations || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && (
                          <button 
                            onClick={() => { setEditingMovement(m); setIsModalOpen(true); }}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(m.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MovementFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave} 
        patients={patients}
        availableProfessionals={availableProfessionals}
        editingMovement={editingMovement}
      />
    </motion.div>
  );
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);

  useEffect(() => {
    const checkSession = async () => {
      const user = await UserService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
      }
      setIsInitialized(true);
    };

    checkSession();

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await UserService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          setIsLoggedIn(true);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const unsubscribePatients = PatientService.subscribeToPatients(setPatients);
    const unsubscribeMovements = MovementService.subscribeToMovements(setMovements);
    const unsubscribePros = ProfessionalService.subscribeToProfessionals(setProfessionals);
    const unsubscribeMunis = MunicipalityService.subscribeToMunicipalities(setMunicipalities);
    const unsubscribeDiagnoses = DiagnosisService.subscribeToDiagnoses(setDiagnoses);

    return () => {
      unsubscribePatients();
      unsubscribeMovements();
      unsubscribePros();
      unsubscribeMunis();
      unsubscribeDiagnoses();
    };
  }, [isLoggedIn]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    await UserService.logout();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('dashboard');
  };

  const canAccess = (page: Page): boolean => {
    if (!currentUser) return false;
    if (currentUser.accessType === 'Administrador') return true;
    
    switch (page) {
      case 'dashboard': return true;
      case 'profile': return true;
      case 'patients': return true;
      case 'movements': return true;
      case 'reports': return currentUser.accessType === 'Coordenação' || currentUser.accessType === 'Administrador';
      case 'professionals': return currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação' || currentUser.accessType === 'Recepção';
      case 'municipalities': return currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação' || currentUser.accessType === 'Recepção';
      case 'diagnoses': return currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação' || currentUser.accessType === 'Recepção';
      case 'trash': return currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação';
      case 'users': return currentUser.accessType === 'Administrador' || currentUser.accessType === 'Coordenação';
      default: return false;
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
        <p className="text-[#064e3b] font-black uppercase tracking-widest text-xs">Carregando Sistema...</p>
      </div>
    );
  }

  if (!isLoggedIn || !currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <motion.aside 
        animate={{ width: sidebarCollapsed ? 80 : 260 }}
        className={`bg-white border-r border-[#064e3b]/5 hidden lg:flex flex-col fixed h-full z-40 transition-all ${sidebarCollapsed ? 'items-center' : 'p-5'}`}
      >
        <div className={`flex items-center mb-10 h-10 ${sidebarCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#064e3b] rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
                <UserSquare2 size={18} className="text-white" />
              </div>
              <span className="font-extrabold text-[#064e3b] tracking-tighter text-xl">CER</span>
            </div>
          )}
          {sidebarCollapsed && (
             <div className="w-12 h-12 bg-[#064e3b] rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
                <UserSquare2 size={24} className="text-white" />
             </div>
          )}
        </div>

        <nav className="space-y-2 flex-1">
          {canAccess('dashboard') && (
            <SidebarItem 
              icon={LayoutDashboard} 
              label="Dashboard" 
              active={currentPage === 'dashboard'} 
              onClick={() => setCurrentPage('dashboard')}
              collapsed={sidebarCollapsed}
            />
          )}
          {canAccess('patients') && (
            <SidebarItem 
              icon={Users} 
              label="Pacientes" 
              active={currentPage === 'patients'} 
              onClick={() => setCurrentPage('patients')}
              collapsed={sidebarCollapsed}
            />
          )}
          {canAccess('movements') && (
            <SidebarItem 
              icon={ClipboardList} 
              label="Movimentações" 
              active={currentPage === 'movements'} 
              onClick={() => setCurrentPage('movements')}
              collapsed={sidebarCollapsed}
            />
          )}
          {canAccess('reports') && (
            <SidebarItem 
              icon={BarChart3} 
              label="Relatórios" 
              active={currentPage === 'reports'} 
              onClick={() => setCurrentPage('reports')}
              collapsed={sidebarCollapsed}
            />
          )}
          {canAccess('professionals') && (
            <SidebarItem 
              icon={Stethoscope} 
              label="Equipe" 
              active={currentPage === 'professionals'} 
              onClick={() => setCurrentPage('professionals')}
              collapsed={sidebarCollapsed}
            />
          )}
          {canAccess('municipalities') && (
            <SidebarItem 
              icon={MapPin} 
              label="Municípios" 
              active={currentPage === 'municipalities'} 
              onClick={() => setCurrentPage('municipalities')}
              collapsed={sidebarCollapsed}
            />
          )}
          {canAccess('diagnoses') && (
            <SidebarItem 
              icon={ClipboardList} 
              label="Diagnósticos" 
              active={currentPage === 'diagnoses'} 
              onClick={() => setCurrentPage('diagnoses')}
              collapsed={sidebarCollapsed}
            />
          )}
          {canAccess('users') && (
            <SidebarItem 
              icon={Shield} 
              label="Usuários" 
              active={currentPage === 'users'} 
              onClick={() => setCurrentPage('users')}
              collapsed={sidebarCollapsed}
            />
          )}
          {canAccess('trash') && (
            <SidebarItem 
              icon={Trash2} 
              label="Lixeira" 
              active={currentPage === 'trash'} 
              onClick={() => setCurrentPage('trash')}
              collapsed={sidebarCollapsed}
            />
          )}
        </nav>

        {!sidebarCollapsed && (
          <div className="mt-auto p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
            <p className="text-[9px] font-black text-emerald-800/40 uppercase tracking-[0.2em] mb-2">Segurança & Auditoria</p>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
              <span className="text-xs text-[#064e3b] font-extrabold uppercase tracking-tight">Ambiente Monitorado</span>
            </div>
            <p className="text-[9px] text-gray-400 font-medium italic leading-relaxed">
              DADOS SENSÍVEIS: Todo acesso é registrado.
            </p>
          </div>
        )}
      </motion.aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all lg:ml-[260px] ${sidebarCollapsed ? 'lg:!ml-20' : ''}`}>
        <Header 
          user={currentUser} 
          onLogout={handleLogout} 
          onProfile={() => setCurrentPage('profile')}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
        />
        
        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            
            {currentPage === 'dashboard' && (
              <DashboardPage 
                key="dashboard" 
                patients={patients} 
                movements={movements} 
                availableCities={municipalities.filter(m => m.status === 'Active').map(m => m.name)}
                availableProfessionals={professionals.filter(p => p.status === 'Active').map(p => p.name)}
                availableDiagnoses={diagnoses.filter(d => d.status === 'Active').map(d => d.name)}
              />
            )}
            {currentPage === 'patients' && (
              <PatientsPage 
                key="patients" 
                patients={patients} 
                currentUser={currentUser}
                availableCities={municipalities.filter(m => m.status === 'Active').map(m => m.name)}
                availableProfessionals={professionals.filter(p => p.status === 'Active').map(p => p.name)}
                availableDiagnoses={diagnoses.filter(d => d.status === 'Active').map(d => d.name)}
                onReload={() => {}} 
              />
            )}
            {currentPage === 'movements' && (
              <MovementsPage 
                key="movements" 
                movements={movements} 
                patients={patients} 
                currentUser={currentUser}
                availableProfessionals={professionals.filter(p => p.status === 'Active').map(p => p.name)}
                onReload={() => {}} 
              />
            )}
            {currentPage === 'reports' && canAccess('reports') && (
              <ReportsPage 
                patients={patients} 
                movements={movements} 
                currentUser={currentUser} 
                availableCities={municipalities.filter(m => m.status === 'Active').map(m => m.name)}
                availableProfessionals={professionals.filter(p => p.status === 'Active').map(p => p.name)}
                availableDiagnoses={diagnoses.filter(d => d.status === 'Active').map(d => d.name)}
              />
            )}
            {currentPage === 'professionals' && canAccess('professionals') && (
              <ProfessionalsPage />
            )}
            {currentPage === 'municipalities' && canAccess('municipalities') && (
              <MunicipalitiesPage />
            )}
            {currentPage === 'diagnoses' && canAccess('diagnoses') && (
              <DiagnosesPage />
            )}
            {currentPage === 'users' && canAccess('users') && (
              <UsersPage currentUser={currentUser} onReload={() => {}} />
            )}
            {currentPage === 'trash' && canAccess('trash') && (
              <TrashPage currentUser={currentUser} />
            )}
            {currentPage === 'profile' && (
              <ProfilePage user={currentUser} onUpdate={(updated) => setCurrentUser(updated)} />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

const LoginPage = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'select'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await UserService.getUsers();
        setUsersList(users);
      } catch (err) {
        console.warn('Error loading user list:', err);
      }
    };
    loadUsers();
  }, []);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim()) {
      setError('Por favor, digite o nome completo ou e-mail.');
      return;
    }
    if (!passwordInput.trim()) {
      setError('Por favor, digite sua senha de acesso.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const user = await UserService.loginWithCredentials(loginInput, passwordInput);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (user: User) => {
    setLoginInput(user.name);
    setPasswordInput(user.password || '123');
    setMode('login');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-emerald-900/5 w-full max-w-lg border border-emerald-50"
      >
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-[#064e3b] rounded-3xl flex items-center justify-center mb-4 shadow-xl shadow-emerald-900/30 transform -rotate-2 hover:rotate-0 transition-transform">
            <UserSquare2 className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-black text-[#064e3b] tracking-tight">CER Policlínica</h2>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Sistema de Controle de Pacientes</p>
        </div>

        {error && (
          <div className="w-full mb-6 bg-red-50 text-red-600 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 border border-red-100 text-center justify-center">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
              mode === 'login' 
                ? 'bg-white text-[#064e3b] shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Entrar com Login e Senha
          </button>
          <button
            type="button"
            onClick={() => { setMode('select'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
              mode === 'select' 
                ? 'bg-white text-[#064e3b] shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Perfis Cadastrados
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2 ml-1">
                Login (Nome Completo ou E-mail)
              </label>
              <div className="relative">
                <UserSquare2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Ex: Gerliane Magalhães"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2 ml-1">
                Senha de Acesso
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-12 py-3.5 rounded-2xl border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#064e3b] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#053d2e] shadow-lg shadow-emerald-900/20 transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Entrar no Sistema'
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 mb-2 text-center">
              Selecione um usuário para selecionar o perfil:
            </p>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {usersList.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleQuickSelect(user)}
                  className="w-full p-4 rounded-2xl border border-gray-100 bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-200 transition-all text-left flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#064e3b] text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-gray-800 group-hover:text-[#064e3b]">{user.name}</p>
                      <p className="text-xs text-gray-500 font-medium">
                        {user.email || user.accessType}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white border border-emerald-100 text-[#064e3b] shadow-xs">
                    {user.accessType}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="h-px bg-gray-100 flex-1"></div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acesso por Nome e Senha</p>
          <div className="h-px bg-gray-100 flex-1"></div>
        </div>
      </motion.div>
    </div>
  );
};


