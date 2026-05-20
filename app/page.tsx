'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  ClipboardList, 
  BrainCircuit, 
  LogOut, 
  Lock, 
  Mail,
  RefreshCw,
  AlertCircle,
  Check,
  Plus,
  Sparkles,
  Trash2,
  Info,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  ArrowRight,
  Pencil
} from 'lucide-react';
import { 
  authService, 
  dataService, 
  Student, 
  Attendance, 
  AppUser 
} from '../lib/firebase';

export default function Home() {
  // Authentication states
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Core application states
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  
  // Initialize dates safely on startup (prevents hydration triggers & effect cascading)
  const [currentDate, setCurrentDate] = useState<string>('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'presensi' | 'ai' | 'laporan' | 'siswa'>('presensi');

  // New Student form states
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentNis, setNewStudentNis] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [studentActionMsg, setStudentActionMsg] = useState<{ type: 'success' | 'res', text: string } | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);

  // Daily attendance grid draft states
  const [draftAttendance, setDraftAttendance] = useState<{[key: string]: { status: 'hadir' | 'alpa' | 'izin' | 'sakit'; note: string }}>({});
  const [attendanceSaveMsg, setAttendanceSaveMsg] = useState<string | null>(null);

  // AI Parser tab states
  const [aiRawText, setAiRawText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [aiParseError, setAiParseError] = useState<string | null>(null);
  const [aiParseResult, setAiParseResult] = useState<Array<{studentId: string; studentName: string; status: 'alpa' | 'izin' | 'sakit'; note: string }> | null>(null);
  const [aiWarningMessage, setAiWarningMessage] = useState<string | null>(null);

  // Interactive local calendar states
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0-indexed

  // Safely initialize date stamps on mount to prevent next hydration diffs
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    setCurrentDate(todayStr);
    setSelectedCalendarDate(todayStr);
  }, []);

  // Helper function to build daily draft (dynamic)
  const updateDraftAttendance = (studentList: Student[], allHistory: Attendance[], date: string) => {
    const draft: {[key: string]: { status: 'hadir' | 'alpa' | 'izin' | 'sakit'; note: string }} = {};
    studentList.forEach(s => {
      const match = allHistory.find(r => r.studentId === s.id && r.date === date);
      if (match) {
        draft[s.id] = { status: match.status, note: match.note || '' };
      } else {
        draft[s.id] = { status: 'hadir', note: '' };
      }
    });
    setDraftAttendance(draft);
  };

  // Load app database
  const loadData = async (targetDate: string) => {
    if (!targetDate) return;
    setLoading(true);
    try {
      const studentList = await dataService.getStudents();
      const attendanceList = await dataService.getAllAttendance();
      setStudents(studentList);
      setAttendanceRecords(attendanceList);
      
      // Seed grid draft for the selected date
      updateDraftAttendance(studentList, attendanceList, targetDate);
    } catch (err) {
      console.error("Gagal memuat data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Monitor Auth State (loadData is declared above)
  useEffect(() => {
    const unsubscribe = authService.subscribeAuth((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      const todayStr = new Date().toISOString().split('T')[0];
      if (currentUser) {
        loadData(todayStr);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update draft when active tracking date shifts
  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    updateDraftAttendance(students, attendanceRecords, newDate);
  };

  // Handle Register or Login
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    
    if (!email || !password) {
      setAuthError("Harap isi email dan kata sandi Anda.");
      return;
    }

    try {
      if (isSignUp) {
        const newUser = await authService.signUp(email, password);
        setAuthSuccess(`Akun ${newUser.email} terdaftar sukses! Silakan login.`);
        setIsSignUp(false);
      } else {
        await authService.signIn(email, password);
      }
    } catch (err: any) {
      setAuthError(err?.message || "Otentikasi gagal. Coba lagi.");
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setUser(null);
  };

  // Submit/Add or Edit Student Handler
  const handleSubmitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentActionMsg(null);

    if (!newStudentName.trim()) {
      setStudentActionMsg({ type: 'res', text: 'Nama siswa tidak boleh kosong!' });
      return;
    }

    if (editingStudent) {
      // Edit mode
      const updatedRecord: Student = {
        ...editingStudent,
        name: newStudentName.trim(),
        nis: newStudentNis.trim() || 'Tidak ada',
        gender: newStudentGender
      };

      try {
        await dataService.updateStudent(updatedRecord);
        setNewStudentName('');
        setNewStudentNis('');
        setEditingStudent(null);
        setStudentActionMsg({ type: 'success', text: `Data siswa "${updatedRecord.name}" berhasil diperbarui.` });
        await loadData(currentDate);
      } catch (err: any) {
        setStudentActionMsg({ type: 'res', text: 'Gagal memperbarui data siswa' });
      }
    } else {
      // Add mode
      const newId = 'student_' + Math.random().toString(36).substr(2, 9);
      const newRecord: Student = {
        id: newId,
        name: newStudentName.trim(),
        nis: newStudentNis.trim() || 'Tidak ada',
        gender: newStudentGender,
        createdAt: new Date().toISOString()
      };

      try {
        await dataService.saveStudent(newRecord);
        setNewStudentName('');
        setNewStudentNis('');
        setStudentActionMsg({ type: 'success', text: `Siswa "${newRecord.name}" berhasil ditambahkan.` });
        await loadData(currentDate);
      } catch (err: any) {
        setStudentActionMsg({ type: 'res', text: 'Gagal menambahkan siswa ke database' });
      }
    }
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    setNewStudentName(student.name);
    setNewStudentNis(student.nis === 'Tidak ada' ? '' : student.nis);
    setNewStudentGender(student.gender);
    setStudentActionMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    setNewStudentName('');
    setNewStudentNis('');
    setNewStudentGender('Laki-laki');
    setStudentActionMsg(null);
  };

  // Delete Student Trigger
  const handleDeleteStudent = (id: string, name: string) => {
    setStudentToDelete({ id, name });
  };

  // Perform actual student deletion
  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    const { id, name } = studentToDelete;
    try {
      await dataService.deleteStudent(id);
      setStudentActionMsg({ type: 'success', text: `Siswa "${name}" telah dihapus.` });
      setStudentToDelete(null);
      await loadData(currentDate);
    } catch (err) {
      setStudentActionMsg({ type: 'res', text: 'Gagal menghapus siswa' });
      setStudentToDelete(null);
    }
  };

  // Save current daily draft attendance to DB
  const handleSaveAttendance = async () => {
    if (!user) return;
    setLoading(true);
    setAttendanceSaveMsg(null);

    const updates: Attendance[] = Object.keys(draftAttendance).map(studentId => {
      const info = draftAttendance[studentId];
      return {
        id: `${currentDate}_${studentId}`,
        date: currentDate,
        studentId,
        status: info.status,
        note: info.note,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid
      };
    });

    try {
      await dataService.saveBatchAttendance(updates);
      setAttendanceSaveMsg("Presensi berhasil disimpan!");
      await loadData(currentDate);
      setTimeout(() => setAttendanceSaveMsg(null), 3000);
    } catch (err) {
      setAttendanceSaveMsg("Error: Gagal menyimpan data presensi.");
    } finally {
      setLoading(false);
    }
  };

  // Daily Grid Draft quick updates
  const setStudentStatus = (studentId: string, status: 'hadir' | 'alpa' | 'izin' | 'sakit') => {
    setDraftAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
  };

  const setStudentNote = (studentId: string, note: string) => {
    setDraftAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        note
      }
    }));
  };

  // AI-Powered Automated Parsing handler
  const handleAITranscriptProcess = async () => {
    if (!aiRawText.trim()) {
      setAiParseError("Tulis atau tempel beberapa teks ketidakhadiran terlebih dahulu.");
      return;
    }
    setAiParsing(true);
    setAiParseError(null);
    setAiParseResult(null);
    setAiWarningMessage(null);

    try {
      const response = await fetch("/api/gemini/parse-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiRawText,
          students: students.map(s => ({ id: s.id, name: s.name }))
        })
      });

      const result = await response.json();
      if (result.error) {
        setAiParseError(result.error);
      } else {
        setAiParseResult(result.data || []);
        if (result.warning) {
          setAiWarningMessage(result.warning);
        }
      }
    } catch (err: any) {
      setAiParseError("Gagal menghubungi server AI. Harap cek kembali koneksi panel.");
    } finally {
      setAiParsing(false);
    }
  };

  // Bulk apply AI parsed outcomes into current draft
  const handleApplyAI = () => {
    if (!aiParseResult) return;

    setDraftAttendance(prev => {
      const updated = { ...prev };
      aiParseResult.forEach(item => {
        if (updated[item.studentId]) {
          updated[item.studentId] = {
            status: item.status,
            note: item.note || `Dicatat oleh AI`
          };
        }
      });
      return updated;
    });

    setActiveTab('presensi');
    setAttendanceSaveMsg("Hasil AI diterapkan ke draf hari ini! Klik 'Simpan Presensi' untuk mempermanenkan.");
    setAiParseResult(null);
    setAiRawText('');
    setAiWarningMessage(null);
  };

  // Calendar calculations
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay(); // 0 is Sunday
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  // Aggregate stats over a selected calendar date or overall
  const getDailyTotals = (dateStr: string) => {
    const list = attendanceRecords.filter(r => r.date === dateStr);
    const totals = { hadir: 0, alpa: 0, izin: 0, sakit: 0 };
    
    students.forEach(s => {
      const match = list.find(r => r.studentId === s.id);
      if (match) {
        totals[match.status]++;
      } else {
        totals.hadir++;
      }
    });

    return totals;
  };

  // Overall database history stats
  const getOverallStats = () => {
    const totalRecordsCount = attendanceRecords.length;
    const totals = { alpa: 0, izin: 0, sakit: 0, hadir: 0 };
    
    attendanceRecords.forEach(r => {
      if (totals[r.status] !== undefined) {
        totals[r.status]++;
      }
    });

    const studentCount = students.length;
    // Assuming active record status calculation over history
    return {
      totalLogs: totalRecordsCount,
      ...totals,
      activeHadir: studentCount * 10 - (totals.alpa + totals.izin + totals.sakit) // Simulated index
    };
  };

  const stats = getOverallStats();
  const selectedDateTotals = getDailyTotals(selectedCalendarDate);

  // List of excuses/non-present students for the selected calendar summary date
  const getAbsenceListForDate = (dateStr: string) => {
    return attendanceRecords.filter(r => r.date === dateStr && r.status !== 'hadir').map(r => {
      const s = students.find(st => st.id === r.studentId);
      return {
        studentName: s ? s.name : 'Siswa Terhapus',
        status: r.status,
        note: r.note || 'Tidak ada keterangan tambahan'
      };
    });
  };

  const absencesForSelectedDate = getAbsenceListForDate(selectedCalendarDate);

  return (
    <div id="app_container" className="min-h-screen bg-slate-50 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Dynamic Header */}
      <header id="app_header" className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div id="header_content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div id="brand_container" className="flex items-center space-x-3">
            <div id="brand_icon" className="w-10 h-10 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-xl flex items-center justify-center text-white shadow-md shadow-teal-100">
              <ClipboardList id="icon_clipboard" className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 id="brand_title" className="text-xl font-bold text-slate-900 tracking-tight leading-none">Kehadiran Saku</h1>
              <p id="brand_sub" className="text-xs text-slate-500 mt-1 font-semibold">Sistem Kehadiran Kelas Cerdas &amp; Otomatis</p>
            </div>
          </div>

          {user && (
            <div id="user_profile_panel" className="flex items-center space-x-4">
              <div id="user_identity" className="hidden sm:block text-right">
                <p id="user_role" className="text-xs font-mono text-slate-500 font-bold">GURU AKTIF</p>
                <p id="user_email_address" className="text-sm font-semibold text-slate-850">{user.email}</p>
              </div>
              <button
                id="btn_logout"
                onClick={handleSignOut}
                className="flex items-center space-x-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:text-red-600 hover:bg-slate-50 transition-colors text-sm font-medium cursor-pointer"
                title="Keluar Aplikasi"
              >
                <LogOut id="icon_logout" className="w-4 h-4" />
                <span className="hidden md:inline">Keluar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Warning local storage banner */}
      <div id="sandbox_banner" className="bg-blue-600 text-white text-xs py-2 px-4 shadow-inner">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 shrink-0" />
            <span><strong>Mode Offline-First Aktif:</strong> Data Anda tersimpan secara otomatis di memori peramban lokal. Anda dapat menggunakannya langsung tanpa setup Firebase yang rumit!</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT WRAPPER */}
      <main id="app_main_content" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {authLoading ? (
          <div id="auth_spinner_container" className="flex flex-col items-center justify-center py-20 space-y-4">
            <RefreshCw id="icon_spinner" className="w-10 h-10 text-teal-600 animate-spin" />
            <p id="auth_spinner_text" className="text-slate-500">Menghubungkan sesi Anda...</p>
          </div>
        ) : !user ? (
          /* AUTH PORTAL */
          <div id="auth_portal" className="max-w-md mx-auto mt-8 sm:mt-12">
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-150/10"
            >
              <div id="auth_header" className="text-center mb-8">
                <div id="auth_bullet_icon" className="w-12 h-12 bg-teal-500 rounded-2xl mx-auto flex items-center justify-center text-white mb-4">
                  <Lock id="icon_lock" className="w-6 h-6" />
                </div>
                <h2 id="auth_portal_title" className="text-2xl font-bold text-slate-800 tracking-tight">
                  {isSignUp ? 'Daftar Akun Guru' : 'Masuk Aplikasi'}
                </h2>
                <p id="auth_portal_sub" className="text-slate-500 text-sm mt-1">
                  Gunakan portal sekolah untuk mulai mengelola kehadiran kelas
                </p>
              </div>

              <form id="auth_form" onSubmit={handleAuthSubmit} className="space-y-5">
                {authError && (
                  <div id="auth_err_alert" className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center space-x-2 text-sm animate-pulse">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {authSuccess && (
                  <div id="auth_success_alert" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg flex items-center space-x-2 text-sm">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{authSuccess}</span>
                  </div>
                )}

                <div id="auth_email_group" className="space-y-1.5">
                  <label htmlFor="auth_email" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider font-mono">Email Sekolah / Guru</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      id="auth_email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="guru@sekolah.sch.id"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-none rounded-xl text-sm transition-all"
                      required
                    />
                  </div>
                </div>

                <div id="auth_password_group" className="space-y-1.5">
                  <label htmlFor="auth_password" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider font-mono">Kata Sandi</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      id="auth_password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-none rounded-xl text-sm transition-all"
                      required
                    />
                  </div>
                </div>

                <button
                  id="btn_auth_submit"
                  type="submit"
                  className="w-full bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md transition-all text-sm flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isSignUp ? 'Daftar Sekarang' : 'Masuk Aplikasi'}
                </button>
              </form>

              <div id="auth_switch_panel" className="mt-6 pt-4 border-t border-slate-100 text-center text-sm text-slate-500">
                {isSignUp ? (
                  <p>Sudah punya akun? <button id="btn_switch_login" onClick={() => { setIsSignUp(false); setAuthError(null); }} className="text-teal-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer">Masuk di sini</button></p>
                ) : (
                  <p>Guru baru di sekolah? <button id="btn_switch_signup" onClick={() => { setIsSignUp(true); setAuthError(null); }} className="text-teal-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer">Buat akun sekarang</button></p>
                )}
              </div>
            </motion.div>
          </div>
        ) : (
          /* APPLICATION VIEWPORT */
          <div id="secure_workspace" className="space-y-6">
            
            {/* AGGREGATED METRICS */}
            <div id="instructor_stats_grid" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div id="card_total_students" className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <p id="lbl_total_students" className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">TOTAL SISWA</p>
                  <h3 id="val_total_students" className="text-2xl font-bold text-slate-800 mt-1">{students.length}</h3>
                </div>
                <div className="w-10 h-10 bg-teal-50 text-teal-500 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div id="card_total_sakit" className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <p id="lbl_total_sakit" className="text-xs font-mono text-amber-500 uppercase tracking-wider font-bold">TOTAL SAKIT</p>
                  <h3 id="val_total_sakit" className="text-2xl font-bold text-amber-600 mt-1">{stats.sakit}</h3>
                </div>
                <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-lg flex items-center justify-center">
                  <span className="font-extrabold text-sm">S</span>
                </div>
              </div>

              <div id="card_total_izin" className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <p id="lbl_total_izin" className="text-xs font-mono text-blue-500 uppercase tracking-wider font-bold">TOTAL IZIN</p>
                  <h3 id="val_total_izin" className="text-2xl font-bold text-blue-600 mt-1">{stats.izin}</h3>
                </div>
                <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center">
                  <span className="font-extrabold text-sm">I</span>
                </div>
              </div>

              <div id="card_total_alpa" className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <p id="lbl_total_alpa" className="text-xs font-mono text-rose-500 uppercase tracking-wider font-bold">TOTAL ALPA</p>
                  <h3 id="val_total_alpa" className="text-2xl font-bold text-rose-600 mt-1">{stats.alpa}</h3>
                </div>
                <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center">
                  <span className="font-extrabold text-sm">A</span>
                </div>
              </div>
            </div>

            {/* TAB CONTAINER TRIGGER BAR */}
            <div id="tab_toggle_bar" className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap gap-1 shadow-sm">
              <button
                id="tab_opt_presensi"
                onClick={() => setActiveTab('presensi')}
                className={`flex-1 min-w-[125px] flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'presensi' 
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-100' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ClipboardList className="w-4 h-4 shrink-0" />
                <span>Presensi Harian</span>
              </button>

              <button
                id="tab_opt_ai"
                onClick={() => setActiveTab('ai')}
                className={`flex-1 min-w-[125px] flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'ai' 
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-100' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BrainCircuit className="w-4 h-4 shrink-0 text-teal-400" />
                <span className="flex items-center space-x-1">
                  <span>Pencatatan AI</span>
                  <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full uppercase scale-90">Auto</span>
                </span>
              </button>

              <button
                id="tab_opt_laporan"
                onClick={() => setActiveTab('laporan')}
                className={`flex-1 min-w-[125px] flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'laporan' 
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-100' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <CalendarIcon className="w-4 h-4 shrink-0" />
                <span>Kalender &amp; Laporan</span>
              </button>

              <button
                id="tab_opt_siswa"
                onClick={() => setActiveTab('siswa')}
                className={`flex-1 min-w-[125px] flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'siswa' 
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-100' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Kelola Siswa</span>
              </button>
            </div>

            {/* TAB CORNER VIEWS */}
            <div id="tab_viewport" className="min-h-[400px]">
              
              {/* TAB 1: ABSENSI MANUAL GRID */}
              {activeTab === 'presensi' && (
                <div id="view_presensi" className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                  <div id="presensi_header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Lembar Kehadiran Kelas</h2>
                      <p className="text-xs text-slate-500">Atur status kehadiran masing-masing siswa untuk tanggal terpilih di bawah.</p>
                    </div>

                    <div id="presensi_date_selector" className="flex items-center space-x-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl shadow-inner">
                      <span className="text-xs font-semibold uppercase text-slate-500 px-2 font-mono">PILIH TANGGAL:</span>
                      <input
                        id="attendance_date_input"
                        type="date"
                        value={currentDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  {attendanceSaveMsg && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className={`p-3 rounded-xl border text-sm flex items-center space-x-2 ${
                        attendanceSaveMsg.includes('Error') 
                          ? 'bg-red-50 border-red-200 text-red-600' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      }`}
                    >
                      <Info className="w-4 h-4 shrink-0" />
                      <span>{attendanceSaveMsg}</span>
                    </motion.div>
                  )}

                  {students.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50/50 rounded-xl border-dashed border-2 border-slate-200">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-1" />
                      <p className="text-slate-600 font-semibold text-sm">Belum ada siswa yang didaftarkan</p>
                      <p className="text-slate-400 text-xs mt-1">Gunakan tab Kelola Siswa di atas untuk menambahkan siswa baru.</p>
                      <button 
                        onClick={() => setActiveTab('siswa')}
                        className="mt-4 inline-flex items-center space-x-2 text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Siswa Baru</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Grid Headers titles */}
                      <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 border-b border-slate-100 bg-slate-50/50 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                        <div className="col-span-2">NIS</div>
                        <div className="col-span-3">Nama Lengkap</div>
                        <div className="col-span-1.5">Gender</div>
                        <div className="col-span-3 text-center">Kehadiran (H / S / I / A)</div>
                        <div className="col-span-2.5">Catatan / Keterangan</div>
                      </div>

                      {/* Students rows list */}
                      <div className="divide-y divide-slate-100">
                        {students.map((st) => {
                          const state = draftAttendance[st.id] || { status: 'hadir', note: '' };
                          return (
                            <div key={st.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 py-3 px-4 items-center hover:bg-slate-50/40 transition-all rounded-lg">
                              
                              {/* Student NIS */}
                              <div className="col-span-2 font-mono text-xs text-slate-500">
                                <span className="lg:hidden font-sans font-semibold text-slate-400 mr-2">NIS:</span>
                                {st.nis}
                              </div>

                              {/* Student Name */}
                              <div className="col-span-3 text-sm font-semibold text-slate-855">
                                {st.name}
                              </div>

                              {/* Student Gender */}
                              <div className="col-span-1.5 text-xs text-slate-600">
                                <span className="lg:hidden font-sans font-semibold text-slate-400 mr-2">Gender:</span>
                                {st.gender}
                              </div>

                              {/* Radios Kehadiran */}
                              <div className="col-span-3 flex items-center justify-between">
                                <span className="lg:hidden text-xs text-slate-400 font-semibold uppercase pr-2">Status:</span>
                                <div className="flex-1 grid grid-cols-4 gap-1.5">
                                  {/* Hadir Option */}
                                  <button
                                    type="button"
                                    onClick={() => setStudentStatus(st.id, 'hadir')}
                                    className={`py-1.5 rounded-lg text-xs font-bold tracking-tight text-center transition-all cursor-pointer ${
                                      state.status === 'hadir'
                                        ? 'bg-emerald-100 border border-emerald-400 text-emerald-800 shadow-sm shadow-emerald-50'
                                        : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                                  >
                                    Hadir
                                  </button>

                                  {/* Sakit Option */}
                                  <button
                                    type="button"
                                    onClick={() => setStudentStatus(st.id, 'sakit')}
                                    className={`py-1.5 rounded-lg text-xs font-bold tracking-tight text-center transition-all cursor-pointer ${
                                      state.status === 'sakit'
                                        ? 'bg-amber-100 border border-amber-400 text-amber-800 shadow-sm shadow-amber-50'
                                        : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                                  >
                                    Sakit
                                  </button>

                                  {/* Izin Option */}
                                  <button
                                    type="button"
                                    onClick={() => setStudentStatus(st.id, 'izin')}
                                    className={`py-1.5 rounded-lg text-xs font-bold tracking-tight text-center transition-all cursor-pointer ${
                                      state.status === 'izin'
                                        ? 'bg-blue-100 border border-blue-400 text-blue-800 shadow-sm shadow-blue-50'
                                        : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                                  >
                                    Izin
                                  </button>

                                  {/* Alpa Option */}
                                  <button
                                    type="button"
                                    onClick={() => setStudentStatus(st.id, 'alpa')}
                                    className={`py-1.5 rounded-lg text-xs font-bold tracking-tight text-center transition-all cursor-pointer ${
                                      state.status === 'alpa'
                                        ? 'bg-rose-100 border border-rose-400 text-rose-800 shadow-sm'
                                        : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                                  >
                                    Alpa
                                  </button>
                                </div>
                              </div>

                              {/* Notes Input */}
                              <div className="col-span-2.5">
                                <input
                                  type="text"
                                  value={state.note}
                                  onChange={(e) => setStudentNote(st.id, e.target.value)}
                                  placeholder={state.status === 'hadir' ? 'Catatan opsional...' : `Alasan ${state.status}...`}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-450 focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Submit action panel */}
                      <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-xs text-slate-500 italic max-w-md">
                          Perubahan draf di atas belum disimpan permanen. Klik &quot;Simpan Presensi&quot; untuk mengarsipkan perubahan harian kelas.
                        </div>
                        <button
                          onClick={handleSaveAttendance}
                          disabled={loading}
                          className="bg-teal-600 hover:bg-teal-750 text-white text-sm font-semibold py-2 px-5 rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 flex items-center space-x-2 transition-all cursor-pointer"
                        >
                          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          <span>Simpan Presensi</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: AI RECORDER VIEW */}
              {activeTab === 'ai' && (
                <div id="view_ai" className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-1.5">
                      <BrainCircuit className="w-5.5 h-5.5 text-teal-600 shrink-0" />
                      <span>Pencatatan Otomatis berbasis AI Gemini</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Tempel draf chat grup perpesanan orang tua murid atau keluhan sekolah secara berkas bebas. AI akan otomatis memisahkan nama siswa dan jenis absennya secara cerdas.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left input section */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-600 uppercase font-mono">Input Kalimat Bebas Guru / Chat Orang Tua</label>
                        <textarea
                          rows={6}
                          value={aiRawText}
                          onChange={(e) => setAiRawText(e.target.value)}
                          placeholder="Contoh: 'Assalamu'alaikum wr. wb., selamat pagi bu guru. Mohon maaf hari ini Rachel Amanda sakit demam tinggi tidak bisa masuk kelas. Lalu Faisal izin karena ada keperluan keluarga ke luar kota.'"
                          className="w-full p-4 bg-slate-50 border border-slate-200 text-sm rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400 font-medium leading-relaxed"
                        />
                      </div>

                      {/* Prompt suggestion buttons */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500">💡 Klik cepat contoh teks simulasi di bawah ini:</p>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <button 
                            type="button"
                            onClick={() => setAiRawText("Diana Puspita sakit pusing demam perlu istirahat di rumah selama 2 hari, dan Eko Wahyudi izin ada hajatan pernikahan kakaknya")}
                            className="bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 transition-all font-semibold cursor-pointer text-left"
                          >
                            &ldquo;Diana sakit demam, Eko izin hajatan...&rdquo;
                          </button>
                          <button 
                            type="button"
                            onClick={() => setAiRawText("Ahmad Faisal alpa tanpa keterangan karena tidak kelihatan di sekolah sampai siang")}
                            className="bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 transition-all font-semibold cursor-pointer text-left"
                          >
                            &ldquo;Ahmad Faisal alpa tanpa keterangan...&rdquo;
                          </button>
                        </div>
                      </div>

                      {aiParseError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center space-x-2 text-xs">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{aiParseError}</span>
                        </div>
                      )}

                      <button
                        onClick={handleAITranscriptProcess}
                        disabled={aiParsing || students.length === 0}
                        className="bg-teal-650 hover:bg-teal-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center space-x-2 active:scale-98 cursor-pointer"
                      >
                        {aiParsing ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
                        )}
                        <span>{aiParsing ? 'Memilah data murid...' : 'Analisis Otomatis via AI'}</span>
                      </button>
                    </div>

                    {/* Right entity response view */}
                    <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-inner">
                      <div>
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">HASIL ANALISIS ENTITAS</h4>
                        
                        {aiWarningMessage && (
                          <div className="mb-3 p-2.5 bg-blue-50 border border-blue-100 text-blue-700 text-[11px] rounded-lg">
                            {aiWarningMessage}
                          </div>
                        )}

                        {!aiParseResult && !aiParsing && (
                          <div className="text-center py-12 text-slate-400">
                            <BrainCircuit className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
                            <p className="text-xs">Tulis transkrip di panel sebelah kiri lalu klik tombol analisis AI untuk melihat hasilnya di sini.</p>
                          </div>
                        )}

                        {aiParsing && (
                          <div className="space-y-3 py-6">
                            <div className="h-4 bg-slate-200 rounded w-2/3 animate-pulse"></div>
                            <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse"></div>
                          </div>
                        )}

                        {aiParseResult && (
                          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                            {aiParseResult.length === 0 ? (
                              <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200 font-semibold">AI tidak menemukan murid absen yang relevan dalam transkrip ini.</p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs text-teal-800 bg-teal-50 px-2.5 py-1.5 rounded-lg font-bold">Terdeteksi Absen:</p>
                                {aiParseResult.map((item, idx) => (
                                  <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-center justify-between shadow-sm">
                                    <div className="max-w-[70%]">
                                      <p className="text-sm font-bold text-slate-800">{item.studentName}</p>
                                      <p className="text-[11px] text-slate-500 mt-0.5">Alasan: {item.note || 'Mencatat ketidakhadiran'}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full uppercase leading-none tracking-wider ${
                                      item.status === 'sakit' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                      item.status === 'izin' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                      'bg-rose-100 text-rose-800 border border-rose-200'
                                    }`}>
                                      {item.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {aiParseResult && aiParseResult.length > 0 && (
                        <div className="pt-4 border-t border-slate-200 mt-4">
                          <button
                            onClick={handleApplyAI}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs shadow flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Terapkan sebagai Draf Harian</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MONTHLY CALENDAR & REPORTS REKAP */}
              {activeTab === 'laporan' && (
                <div id="view_laporan" className="space-y-6 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* Visual Interactive Calendar grid card */}
                    <div className="md:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                          <h3 className="text-base font-bold text-slate-800">Kalender Kehadiran &amp; Absen</h3>
                          <p className="text-xs text-slate-500">Pilih tanggal di kalender untuk melihat ringkasan absen murid hari itu.</p>
                        </div>
                        
                        <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                          <button 
                            onClick={prevMonth}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded cursor-pointer transition-all"
                          >
                            <ChevronLeft className="w-4 h-4 text-slate-600" />
                          </button>
                          <span className="text-xs font-bold text-slate-700 px-2 min-w-[125px] text-center uppercase tracking-wider font-mono">
                            {monthNames[viewMonth]} {viewYear}
                          </span>
                          <button 
                            onClick={nextMonth}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded cursor-pointer transition-all"
                          >
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          </button>
                        </div>
                      </div>

                      {/* Day titles headers table */}
                      <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 uppercase text-[10px] mb-2 font-mono">
                        <div>Min</div>
                        <div>Sen</div>
                        <div>Sel</div>
                        <div>Rab</div>
                        <div>Kam</div>
                        <div>Jum</div>
                        <div>Sab</div>
                      </div>

                      {/* Day values grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {/* Empty spacers for month offset start */}
                        {Array.from({ length: getFirstDayOfMonth(viewYear, viewMonth) }).map((_, idx) => (
                          <div key={`empty_${idx}`} className="h-16 bg-slate-50/40 rounded-lg"></div>
                        ))}

                        {/* Valid days list */}
                        {Array.from({ length: getDaysInMonth(viewYear, viewMonth) }).map((_, idx) => {
                          const dayNum = idx + 1;
                          const pad = (n: number) => n.toString().padStart(2, '0');
                          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(dayNum)}`;
                          
                          const recsForDay = attendanceRecords.filter(r => r.date === dateStr);
                          const alpas = recsForDay.filter(r => r.status === 'alpa').length;
                          const izins = recsForDay.filter(r => r.status === 'izin').length;
                          const sakits = recsForDay.filter(r => r.status === 'sakit').length;

                          const isSelectedDay = selectedCalendarDate === dateStr;

                          return (
                            <button
                              key={`day_${dayNum}`}
                              type="button"
                              onClick={() => setSelectedCalendarDate(dateStr)}
                              className={`h-16 rounded-lg p-1.5 flex flex-col justify-between items-start transition-all text-left relative overflow-hidden border cursor-pointer ${
                                isSelectedDay 
                                  ? 'bg-teal-550 border-teal-500 ring-2 ring-teal-200 text-teal-980' 
                                  : 'bg-white border-slate-100 hover:border-slate-300'
                              }`}
                            >
                              <span className={`text-xs font-bold font-mono ${isSelectedDay ? 'text-teal-900 bg-teal-100 w-5 h-5 flex items-center justify-center rounded-full' : 'text-slate-600'}`}>{dayNum}</span>
                              
                              {recsForDay.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-1 w-full scale-90 origin-bottom-left">
                                  {sakits > 0 && <span className="w-2.5 h-2.5 bg-amber-400 rounded-full flex items-center justify-center text-[7px] text-amber-900 font-bold" title={`${sakits} Sakit`}>S</span>}
                                  {izins > 0 && <span className="w-2.5 h-2.5 bg-blue-400 rounded-full flex items-center justify-center text-[7px] text-blue-900 font-bold" title={`${izins} Izin`}>I</span>}
                                  {alpas > 0 && <span className="w-2.5 h-2.5 bg-rose-400 rounded-full flex items-center justify-center text-[7px] text-white font-bold" title={`${alpas} Alpa`}>A</span>}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right summary rekap detail context for selected date */}
                    <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-inner">
                      <div className="space-y-5">
                        <div className="border-b border-slate-200 pb-3">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">REKAP DETAIL HARIAN</h4>
                          <p className="text-sm font-bold text-slate-800 mt-1.5">Tanggal: {selectedCalendarDate}</p>
                        </div>

                        {/* Totals for the selected calendar date */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="bg-white border border-slate-100 p-2 rounded-lg">
                            <span className="text-[10px] text-emerald-600 font-bold block">Hadir</span>
                            <span className="text-base font-bold text-slate-800">{selectedDateTotals.hadir}</span>
                          </div>
                          <div className="bg-white border border-slate-100 p-2 rounded-lg">
                            <span className="text-[10px] text-amber-600 font-bold block">Sakit</span>
                            <span className="text-base font-bold text-slate-850">{selectedDateTotals.sakit}</span>
                          </div>
                          <div className="bg-white border border-slate-100 p-2 rounded-lg">
                            <span className="text-[10px] text-blue-600 font-bold block">Izin</span>
                            <span className="text-base font-bold text-slate-850">{selectedDateTotals.izin}</span>
                          </div>
                          <div className="bg-white border border-slate-100 p-2 rounded-lg">
                            <span className="text-[10px] text-rose-600 font-bold block">Alpa</span>
                            <span className="text-base font-bold text-slate-850">{selectedDateTotals.alpa}</span>
                          </div>
                        </div>

                        {/* List of absent students on this day */}
                        <div className="space-y-2.5">
                          <h5 className="text-[11px] font-mono text-slate-400 font-bold uppercase">Siswa Absen Hari Ini:</h5>
                          
                          {absencesForSelectedDate.length === 0 ? (
                            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-3 rounded-lg font-semibold">Semua siswa terekam Masuk / Hadir penuh!</p>
                          ) : (
                            <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                              {absencesForSelectedDate.map((item, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs">
                                  <div className="flex items-center justify-between font-bold text-slate-800">
                                    <span>{item.studentName}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                      item.status === 'sakit' ? 'bg-amber-100 text-amber-850' :
                                      item.status === 'izin' ? 'bg-blue-100 text-blue-850' :
                                      'bg-rose-105 text-rose-800'
                                    }`}>
                                      {item.status}
                                    </span>
                                  </div>
                                  <p className="text-slate-500 mt-1 italic">&ldquo;{item.note}&rdquo;</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 mt-4 flex justify-end">
                        <button
                          onClick={() => handleDateChange(selectedCalendarDate)}
                          className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
                        >
                          <span>Kelola Presensi Tanggal Ini</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 4: KELOLA SISWA (Add & lists murid) */}
              {activeTab === 'siswa' && (
                <div id="view_siswa" className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Add new Student Form */}
                    <div className="lg:col-span-5 space-y-5">
                      <div>
                        <h3 className="text-base font-bold text-slate-800 flex items-center space-x-1.5">
                          {editingStudent ? (
                            <Pencil className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <UserPlus className="w-5 h-5 text-teal-600" />
                          )}
                          <span>{editingStudent ? 'Ubah Data Siswa' : 'Daftarkan Siswa Baru'}</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {editingStudent 
                            ? 'Ubah informasi detail nama atau nomor induk siswa di bawah.' 
                            : 'Siswa baru yang ditambahkan akan otomatis terdaftar di lembar absensi.'}
                        </p>
                      </div>

                      <form id="add_student_form" onSubmit={handleSubmitStudent} className="space-y-4">
                        {studentActionMsg && (
                          <div className={`p-3 rounded-lg border text-xs flex items-center space-x-2 ${
                            studentActionMsg.type === 'res' 
                              ? 'bg-red-50 border-red-200 text-red-650 font-semibold' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-650'
                          }`}>
                            <Info className="w-4 h-4 shrink-0" />
                            <span>{studentActionMsg.text}</span>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600 font-mono">NAMA LENGKAP SISWA</label>
                          <input
                            type="text"
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            placeholder="Rachel Amanda"
                            className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-none rounded-xl px-3 py-2 text-sm transition-all"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-600 font-mono">NOMOR INDUK SISWA (NIS)</label>
                          <input
                            type="text"
                            value={newStudentNis}
                            onChange={(e) => setNewStudentNis(e.target.value)}
                            placeholder="10101"
                            className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white focus:outline-none rounded-xl px-3 py-2 text-sm transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-600 font-mono">JENIS KELAMIN</label>
                          <div className="flex gap-3">
                            <label className="flex-1 flex items-center justify-center space-x-2 border border-slate-200 p-2.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-50">
                              <input
                                type="radio"
                                name="newStudentGender"
                                checked={newStudentGender === 'Laki-laki'}
                                onChange={() => setNewStudentGender('Laki-laki')}
                                className="accent-teal-600"
                              />
                              <span>Laki-laki</span>
                            </label>
                            
                            <label className="flex-1 flex items-center justify-center space-x-2 border border-slate-200 p-2.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-50">
                              <input
                                type="radio"
                                name="newStudentGender"
                                checked={newStudentGender === 'Perempuan'}
                                onChange={() => setNewStudentGender('Perempuan')}
                                className="accent-teal-600"
                              />
                              <span>Perempuan</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          {editingStudent && (
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all cursor-pointer text-center"
                            >
                              Batal
                            </button>
                          )}
                          <button
                            type="submit"
                            className={`flex-[2] w-full font-semibold py-2.5 px-4 rounded-xl text-sm shadow flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                              editingStudent 
                                ? 'bg-indigo-650 hover:bg-indigo-700 text-white shadow-indigo-100' 
                                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-100'
                            }`}
                          >
                            {editingStudent ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                            <span>{editingStudent ? 'Simpan Perubahan' : 'Daftarkan ke Kelas'}</span>
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Registrated Student Lists */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">DAFTAR SISWA KELAS</h4>
                        <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{students.length} Murid</span>
                      </div>

                      {students.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <p className="text-sm">Tidak ada siswa terdaftar.</p>
                        </div>
                      ) : (
                        <div className="overflow-hidden border border-slate-200 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-550 uppercase tracking-wider font-mono">
                                <th className="p-3.5 pl-4">NIS</th>
                                <th className="p-3.5">Nama Lengkap</th>
                                <th className="p-3.5">Gender</th>
                                <th className="p-3.5 pr-4 text-right">Opsi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                              {students.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3.5 pl-4 font-mono text-xs text-slate-500">{s.nis}</td>
                                  <td className="p-3.5 font-bold text-slate-800">{s.name}</td>
                                  <td className="p-3.5 text-xs text-slate-600">{s.gender}</td>
                                  <td className="p-3.5 pr-4 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                      <button
                                        onClick={() => handleEditClick(s)}
                                        className="p-1 px-2 text-indigo-650 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-lg transition-all cursor-pointer"
                                        title="Ubah Siswa"
                                      >
                                        <Pencil className="w-3.5 h-3.5 inline mr-1" />
                                        <span className="text-[11px] font-semibold">Ubah</span>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteStudent(s.id, s.name)}
                                        className="p-1 px-2 text-red-650 hover:bg-red-50 border border-slate-100 hover:border-red-200 rounded-lg transition-all cursor-pointer"
                                        title="Hapus Siswa"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                                        <span className="text-[11px] font-semibold">Hapus</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </main>

      <footer id="app_footer" className="bg-white border-t border-slate-200 py-6 mt-12 transition-all">
        <div id="footer_content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
          <p id="copyright">© 2026 Kehadiran Saku. Hak Cipta Dilindungi.</p>
          <p id="system_version" className="mt-2 sm:mt-0 font-mono tracking-wider">v1.1.0-offline • AI Studio Engine</p>
        </div>
      </footer>

      {/* Custom Confirmation Modal for Deletion */}
      {studentToDelete && (
        <div id="modal_delete_student" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center space-x-3 text-red-600">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Hapus Data Siswa</h3>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus siswa bernama <strong className="text-slate-900">&quot;{studentToDelete.name}&quot;</strong>? Semua riwayat absensi siswa ini juga akan terhapus secara permanen.
            </p>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-250 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all cursor-pointer text-center border border-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteStudent}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all cursor-pointer text-center shadow-md shadow-red-100"
              >
                Ya, Hapus
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
