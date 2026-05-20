export interface AppUser {
  uid: string;
  email: string;
}

export interface Student {
  id: string;
  name: string;
  nis: string;
  gender: 'Laki-laki' | 'Perempuan';
  createdAt: string;
}

export interface Attendance {
  id: string; // matches `${date}_${studentId}`
  date: string;
  studentId: string;
  status: 'hadir' | 'alpa' | 'izin' | 'sakit';
  note?: string;
  updatedAt: string;
  updatedBy: string;
}

// Client-side fallback authentication service using localStorage
export const authService = {
  isConfigured: () => {
    return false; // Show local fallback warning banner
  },
  
  subscribeAuth: (callback: (user: AppUser | null) => void) => {
    if (typeof window === 'undefined') {
      callback(null);
      return () => {};
    }
    
    const getStoredUser = (): AppUser | null => {
      const stored = localStorage.getItem('ks_user');
      return stored ? JSON.parse(stored) : null;
    };
    
    callback(getStoredUser());
    
    const handleStorageChange = () => {
      callback(getStoredUser());
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  },
  
  signUp: async (email: string, pass: string): Promise<AppUser> => {
    const user: AppUser = { uid: 'user_guru_1', email };
    if (typeof window !== 'undefined') {
      localStorage.setItem('ks_user_db', JSON.stringify({ email, pass }));
    }
    return user;
  },
  
  signIn: async (email: string, pass: string): Promise<AppUser> => {
    const lowerEmail = email.toLowerCase().trim();
    const isAdmin = lowerEmail === 'admin' || lowerEmail === 'admin@sekolah.sch.id' || lowerEmail === 'admin@gmail.com';
    
    if (isAdmin && pass === '123456') {
      const user: AppUser = { uid: 'admin_user', email: lowerEmail.includes('@') ? lowerEmail : 'admin@sekolah.sch.id' };
      if (typeof window !== 'undefined') {
        localStorage.setItem('ks_user', JSON.stringify(user));
        window.dispatchEvent(new Event('storage'));
      }
      return user;
    }
    
    if (typeof window !== 'undefined') {
      const storedDbRaw = localStorage.getItem('ks_user_db');
      if (storedDbRaw) {
        const storedDb = JSON.parse(storedDbRaw);
        if (storedDb.email.toLowerCase().trim() === lowerEmail && storedDb.pass === pass) {
          const user: AppUser = { uid: 'user_guru_1', email: storedDb.email };
          localStorage.setItem('ks_user', JSON.stringify(user));
          window.dispatchEvent(new Event('storage'));
          return user;
        }
      }
    }
    
    throw new Error("Email atau kata sandi salah. Gunakan 'admin' dengan kata sandi '123456'.");
  },
  
  signOut: async (): Promise<void> => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ks_user');
      window.dispatchEvent(new Event('storage'));
    }
  }
};

// Client-side local storage data service
export const dataService = {
  getStudents: async (): Promise<Student[]> => {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem('ks_students');
    if (!raw) {
      // Seed nice initial students so the app isn't empty on opening
      const mockStudents: Student[] = [
        { id: 'st_1', name: 'Rachel Amanda', nis: '10101', gender: 'Perempuan', createdAt: new Date().toISOString() },
        { id: 'st_2', name: 'Diana Puspita', nis: '10102', gender: 'Perempuan', createdAt: new Date().toISOString() },
        { id: 'st_3', name: 'Ahmad Faisal', nis: '10103', gender: 'Laki-laki', createdAt: new Date().toISOString() },
        { id: 'st_4', name: 'Bunga Citra', nis: '10104', gender: 'Perempuan', createdAt: new Date().toISOString() },
        { id: 'st_5', name: 'Eko Wahyudi', nis: '10105', gender: 'Laki-laki', createdAt: new Date().toISOString() }
      ];
      localStorage.setItem('ks_students', JSON.stringify(mockStudents));
      return mockStudents;
    }
    return JSON.parse(raw);
  },
  
  saveStudent: async (student: Student): Promise<void> => {
    if (typeof window === 'undefined') return;
    const students = await dataService.getStudents();
    students.push(student);
    localStorage.setItem('ks_students', JSON.stringify(students));
  },
  
  updateStudent: async (student: Student): Promise<void> => {
    if (typeof window === 'undefined') return;
    const students = await dataService.getStudents();
    const idx = students.findIndex(s => s.id === student.id);
    if (idx !== -1) {
      students[idx] = student;
      localStorage.setItem('ks_students', JSON.stringify(students));
    }
  },
  
  deleteStudent: async (id: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const students = await dataService.getStudents();
    const updated = students.filter(s => s.id !== id);
    localStorage.setItem('ks_students', JSON.stringify(updated));
    
    // Clean up corresponding attendance
    const attendance = await dataService.getAllAttendance();
    const updatedAttendance = attendance.filter(a => a.studentId !== id);
    localStorage.setItem('ks_attendance', JSON.stringify(updatedAttendance));
  },
  
  getAllAttendance: async (): Promise<Attendance[]> => {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem('ks_attendance');
    return raw ? JSON.parse(raw) : [];
  },
  
  saveBatchAttendance: async (records: Attendance[]): Promise<void> => {
    if (typeof window === 'undefined') return;
    const existing = await dataService.getAllAttendance();
    const map = new Map<string, Attendance>();
    existing.forEach(r => map.set(r.id, r));
    records.forEach(r => map.set(r.id, r));
    localStorage.setItem('ks_attendance', JSON.stringify(Array.from(map.values())));
  }
};
