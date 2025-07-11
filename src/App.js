import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, onSnapshot, doc, deleteDoc, writeBatch, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Upload, Calendar as CalendarIcon, UserPlus, Trash2, BookOpen, BarChart2, Users, FileText, UserCheck, Search, Pencil } from 'lucide-react';

// --- Konfigurasi Firebase ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-attendance-app';

// --- Inisialisasi Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Komponen UI ---
const Card = ({ children, className = '' }) => <div className={`bg-white rounded-xl shadow-md p-6 ${className}`}>{children}</div>;
const Button = ({ children, onClick, variant = 'primary', className = '', ...props }) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2';
  const variants = { primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500', secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400', danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500' };
  return <button onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};
const Input = (props) => <input {...props} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />;
const Select = ({ children, ...props }) => <select {...props} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">{children}</select>;
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-slate-800">{title}</h2><button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl leading-none">&times;</button></div>{children}</div>
        </div>
    );
};
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <p className="text-slate-600 mb-6">{message}</p>
            <div className="flex justify-end gap-3"><Button onClick={onClose} variant="secondary">Batal</Button><Button onClick={onConfirm} variant="danger">Ya, Hapus</Button></div>
        </Modal>
    );
};

// --- Halaman Utama Aplikasi ---
export default function App() {
  const [currentPage, setCurrentPage] = useState('attendance');
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) { setUserId(user.uid); } else { try { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } else { await signInAnonymously(auth); } } catch (error) { console.error("Authentication error:", error); } }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);
  if (!isAuthReady) { return <div className="flex items-center justify-center min-h-screen bg-slate-100"><p className="text-lg">Memuat aplikasi...</p></div>; }
  const NavItem = ({ page, label, icon }) => (<button onClick={() => setCurrentPage(page)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${ currentPage === page ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200' }`}>{icon}{label}</button>);
  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10"><div className="container mx-auto px-4 py-3 flex justify-between items-center"><div className="flex items-center gap-2"><BookOpen className="text-indigo-600" size={28} /><h1 className="text-2xl font-bold text-slate-800">Absensi Kelas</h1></div><nav className="flex items-center gap-2"><NavItem page="attendance" label="Absensi" icon={<CalendarIcon size={16} />} /><NavItem page="reports" label="Laporan" icon={<BarChart2 size={16} />} /><NavItem page="manage" label="Kelola Data" icon={<Users size={16} />} /></nav></div></header>
      <main className="container mx-auto p-4 md:p-6">{userId && (<>{currentPage === 'attendance' && <AttendancePage userId={userId} />}{currentPage === 'reports' && <ReportsPage userId={userId} />}{currentPage === 'manage' && <ManageDataPage userId={userId} />}</>)}</main>
      <footer className="text-center py-4 text-slate-500 text-sm">
          <p>Created by Irwan Darma, S.Pd.I</p>
          <p className="mt-1 text-xs">User ID: {userId}</p>
      </footer>
    </div>
  );
}

// --- Komponen Kelola Data ---
function ManageDataPage({ userId }) {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [newClassName, setNewClassName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [selectedClassForStudent, setSelectedClassForStudent] = useState('');
  
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  
  // State untuk modal upload
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [studentListText, setStudentListText] = useState('');
  const [selectedClassForUpload, setSelectedClassForUpload] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // State untuk modal edit dan hapus
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, title: '', message: '' });

  const privateCollection = (name) => collection(db, 'artifacts', appId, 'users', userId, name);

  useEffect(() => {
    const q = query(privateCollection('classes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setClasses(classesData);
      if (classesData.length > 0) {
        if (!selectedClassForStudent) setSelectedClassForStudent(classesData[0].id);
        if (!selectedClassForUpload) setSelectedClassForUpload(classesData[0].id);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const q = query(privateCollection('students'));
    const unsubscribe = onSnapshot(q, (snapshot) => setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, [userId]);

  const handleAddClass = async (e) => { e.preventDefault(); if (newClassName.trim() === '') return; await addDoc(privateCollection('classes'), { name: newClassName.trim(), createdAt: serverTimestamp() }); setNewClassName(''); };
  const handleAddStudent = async (e) => { e.preventDefault(); if (newStudentName.trim() === '' || !selectedClassForStudent) return; await addDoc(privateCollection('students'), { name: newStudentName.trim(), classId: selectedClassForStudent, createdAt: serverTimestamp() }); setNewStudentName(''); };
  
  const openEditModal = (item, type) => { setEditingItem({ ...item, type }); setEditingValue(item.name); setIsEditModalOpen(true); };
  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!editingItem || editingValue.trim() === '') return;
    const itemRef = doc(db, 'artifacts', appId, 'users', userId, editingItem.type === 'class' ? 'classes' : 'students', editingItem.id);
    await updateDoc(itemRef, { name: editingValue.trim() });
    setIsEditModalOpen(false);
    setEditingItem(null);
  };
  
  const handleDeleteClick = (item, type) => { setConfirmModal({ isOpen: true, title: `Hapus Data`, message: `Anda yakin ingin menghapus "${item.name}"? ${type === 'class' ? 'Semua data siswa di dalam kelas ini juga akan terhapus.' : ''}`, onConfirm: () => handleConfirmDelete(item, type) }); };
  const handleConfirmDelete = async (item, type) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, type === 'class' ? 'classes' : 'students', item.id));
      if (type === 'class') {
        const q = query(privateCollection('students'), where("classId", "==", item.id));
        const studentDocs = await getDocs(q);
        const batch = writeBatch(db);
        studentDocs.forEach(studentDoc => batch.delete(studentDoc.ref));
        await batch.commit();
      }
    } catch (e) { console.error("Gagal menghapus:", e); } finally { setConfirmModal({ isOpen: false }); }
  };
  
  const handleBulkUploadStudents = async (e) => {
    e.preventDefault();
    if (studentListText.trim() === '' || !selectedClassForUpload) {
      setUploadMessage("Pastikan daftar nama siswa tidak kosong dan kelas sudah dipilih.");
      return;
    }
    setIsUploading(true);
    setUploadMessage('Mengunggah...');
    const studentNames = studentListText.split('\n').map(name => name.trim()).filter(name => name !== '');
    if (studentNames.length === 0) {
      setUploadMessage("Tidak ada nama siswa yang valid.");
      setIsUploading(false);
      return;
    }
    const batch = writeBatch(db);
    studentNames.forEach(name => {
      const studentRef = doc(privateCollection('students'));
      batch.set(studentRef, { name, classId: selectedClassForUpload, createdAt: serverTimestamp() });
    });
    try {
      await batch.commit();
      setUploadMessage(`${studentNames.length} siswa berhasil ditambahkan!`);
      setStudentListText('');
      setTimeout(() => { setIsUploadModalOpen(false); setUploadMessage(''); }, 2000);
    } catch (error) {
      console.error("Gagal mengunggah siswa: ", error);
      setUploadMessage("Terjadi kesalahan. Coba lagi.");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredClasses = useMemo(() => classes.filter(c => c.name.toLowerCase().includes(classSearchTerm.toLowerCase())), [classes, classSearchTerm]);
  const filteredStudents = useMemo(() => students.filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase())), [students, studentSearchTerm]);

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Kelola Kelas</h2>
          <form onSubmit={handleAddClass} className="flex gap-2 mb-4"><Input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="Nama Kelas Baru" required/><Button type="submit">Tambah</Button></form>
          <div className="relative mb-2"><Input type="text" placeholder="Cari kelas..." value={classSearchTerm} onChange={e => setClassSearchTerm(e.target.value)}/><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/></div>
          <div className="space-y-2 max-h-60 overflow-y-auto">{isLoading ? <p>Memuat...</p> : filteredClasses.map(c => (<div key={c.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg"><span className="text-slate-700">{c.name}</span><div className="flex gap-2"><button onClick={() => openEditModal(c, 'class')} className="text-blue-500 hover:text-blue-700"><Pencil size={16} /></button><button onClick={() => handleDeleteClick(c, 'class')} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button></div></div>))}</div>
        </Card>
        <Card>
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-slate-800">Kelola Siswa</h2><Button onClick={() => setIsUploadModalOpen(true)} variant="secondary" className="text-sm py-1 px-3"><Upload size={14}/> Upload</Button></div>
          <form onSubmit={handleAddStudent} className="space-y-3"><Input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Nama Siswa Baru" required/><Select value={selectedClassForStudent} onChange={e => setSelectedClassForStudent(e.target.value)} required><option value="" disabled>Pilih Kelas</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select><Button type="submit" className="w-full"><UserPlus size={16} /> Tambah Siswa</Button></form>
        </Card>
        <div className="md:col-span-2">
          <Card>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Daftar Siswa</h2>
            <div className="relative mb-2"><Input type="text" placeholder="Cari siswa..." value={studentSearchTerm} onChange={e => setStudentSearchTerm(e.target.value)}/><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/></div>
            <div className="space-y-2 max-h-96 overflow-y-auto">{filteredStudents.map(s => { const studentClass = classes.find(c => c.id === s.classId); return (<div key={s.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"><div><p className="font-semibold text-slate-800">{s.name}</p><p className="text-sm text-slate-500">{studentClass ? studentClass.name : 'Kelas tidak ada'}</p></div><div className="flex gap-2"><button onClick={() => openEditModal(s, 'student')} className="text-blue-500 hover:text-blue-700"><Pencil size={16} /></button><button onClick={() => handleDeleteClick(s, 'student')} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button></div></div>); })}</div>
          </Card>
        </div>
      </div>
      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload Daftar Siswa Sekaligus">
        <form onSubmit={handleBulkUploadStudents} className="space-y-4">
            <Select value={selectedClassForUpload} onChange={e => setSelectedClassForUpload(e.target.value)} required>
              <option value="" disabled>Pilih Kelas</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <textarea value={studentListText} onChange={e => setStudentListText(e.target.value)} rows="10" className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Budi Doremi&#x0a;Siti Nurbaya&#x0a;Joko Anwar" required />
            <Button type="submit" className="w-full" disabled={isUploading}>{isUploading ? 'Mengunggah...' : 'Unggah Siswa'}</Button>
            {uploadMessage && <p className="text-center text-sm mt-2 font-medium text-indigo-600">{uploadMessage}</p>}
        </form>
      </Modal>
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Nama ${editingItem?.type === 'class' ? 'Kelas' : 'Siswa'}`}>
        <form onSubmit={handleUpdateItem} className="space-y-4"><Input type="text" value={editingValue} onChange={e => setEditingValue(e.target.value)} required/><Button type="submit" className="w-full">Simpan Perubahan</Button></form>
      </Modal>
      <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message}/>
    </>
  );
}

// --- Komponen Absensi Harian ---
function AttendancePage({ userId }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const privateCollection = (name) => collection(db, 'artifacts', appId, 'users', userId, name);
  useEffect(() => { const q = query(privateCollection('classes')); const unsubscribe = onSnapshot(q, (snapshot) => { const classesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); setClasses(classesData); if (classesData.length > 0 && !selectedClass) setSelectedClass(classesData[0].id); }); return () => unsubscribe(); }, [userId]);
  useEffect(() => { if (!selectedClass || !userId || !date) { setStudents([]); return; } setIsLoading(true); const studentsQuery = query(privateCollection('students'), where('classId', '==', selectedClass)); const unsubscribeStudents = onSnapshot(studentsQuery, async (studentSnapshot) => { const studentList = studentSnapshot.docs.map(d => ({ id: d.id, ...d.data() })); setStudents(studentList); const attendanceQuery = query(privateCollection('attendance'), where('classId', '==', selectedClass)); const attendanceSnapshot = await getDocs(attendanceQuery); const selectedDateStr = new Date(date).toDateString(); const savedAttendanceForDate = {}; attendanceSnapshot.forEach(doc => { const data = doc.data(); if (data.date && data.date.toDate().toDateString() === selectedDateStr) { savedAttendanceForDate[data.studentId] = { status: data.status, note: data.note || '' }; } }); const initialAttendance = {}; studentList.forEach(student => { initialAttendance[student.id] = savedAttendanceForDate[student.id] || { status: 'Hadir', note: '' }; }); setAttendance(initialAttendance); setIsLoading(false); }, (error) => { console.error("Error fetching students:", error); setIsLoading(false); }); return () => unsubscribeStudents(); }, [selectedClass, userId, date]);
  const handleStatusChange = (studentId, status) => { setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } })); };
  const handleNoteChange = (studentId, note) => { setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], note } })); };
  const saveAttendance = async () => { if (students.length === 0) { setMessage('Tidak ada siswa di kelas ini.'); setTimeout(() => setMessage(''), 3000); return; } setIsLoading(true); setMessage(''); try { const attendanceDate = new Date(date); const allAttendanceForClassQuery = query(privateCollection('attendance'), where('classId', '==', selectedClass)); const allAttendanceForClassSnapshot = await getDocs(allAttendanceForClassQuery); const deleteBatch = writeBatch(db); const selectedDateStr = attendanceDate.toDateString(); allAttendanceForClassSnapshot.forEach(doc => { const data = doc.data(); if (data.date && data.date.toDate().toDateString() === selectedDateStr) deleteBatch.delete(doc.ref); }); await deleteBatch.commit(); const saveBatch = writeBatch(db); Object.entries(attendance).forEach(([studentId, data]) => { if (students.some(s => s.id === studentId)) { const attendanceRef = doc(privateCollection('attendance')); saveBatch.set(attendanceRef, { studentId, classId: selectedClass, date: Timestamp.fromDate(attendanceDate), status: data.status, note: data.note || '', createdAt: serverTimestamp() }); } }); await saveBatch.commit(); setMessage('Absensi berhasil disimpan!'); } catch (error) { console.error("Error saving attendance: ", error); setMessage('Gagal menyimpan absensi.'); } finally { setIsLoading(false); setTimeout(() => setMessage(''), 3000); } };
  const STATUS_OPTIONS = ['Hadir', 'Sakit', 'Izin', 'Alpa'];
  const STATUS_COLORS = { Hadir: 'bg-green-500 hover:bg-green-600', Sakit: 'bg-yellow-500 hover:bg-yellow-600', Izin: 'bg-blue-500 hover:bg-blue-600', Alpa: 'bg-red-500 hover:bg-red-600' };
  const ACTIVE_STATUS_COLORS = { Hadir: 'bg-green-600 ring-2 ring-green-700', Sakit: 'bg-yellow-600 ring-2 ring-yellow-700', Izin: 'bg-blue-600 ring-2 ring-blue-700', Alpa: 'bg-red-600 ring-2 ring-red-700' };
  return (
    <Card>
      <div className="flex flex-wrap gap-4 items-center mb-6"><div className="flex-grow"><label className="block text-sm font-medium text-slate-600 mb-1">Pilih Kelas</label><Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}><option value="" disabled>Pilih Kelas...</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div><div className="flex-grow"><label className="block text-sm font-medium text-slate-600 mb-1">Tanggal</label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div></div>
      {isLoading && <p className="text-center p-4">Memuat daftar siswa...</p>}
      {!isLoading && students.length > 0 && (<div className="space-y-3">{students.map(student => (<div key={student.id} className="p-4 bg-slate-50 rounded-lg flex flex-col gap-3"><div className="flex flex-col md:flex-row justify-between items-center w-full"><p className="font-semibold text-slate-800 mb-2 md:mb-0">{student.name}</p><div className="flex gap-2 flex-wrap justify-center">{STATUS_OPTIONS.map(status => <button key={status} onClick={() => handleStatusChange(student.id, status)} className={`px-3 py-1 text-sm text-white rounded-full transition-all ${ attendance[student.id]?.status === status ? ACTIVE_STATUS_COLORS[status] : STATUS_COLORS[status] }`}>{status}</button>)}</div></div>{(attendance[student.id]?.status === 'Sakit' || attendance[student.id]?.status === 'Izin') && (<Input type="text" placeholder="Tambahkan catatan (opsional)..." value={attendance[student.id]?.note || ''} onChange={(e) => handleNoteChange(student.id, e.target.value)} className="mt-2"/>)}</div>))}</div>)}
      {!isLoading && students.length > 0 && <div className="mt-6 text-center"><Button onClick={saveAttendance} disabled={isLoading}>{isLoading ? 'Menyimpan...' : 'Simpan Absensi'}</Button>{message && <p className="mt-4 text-sm font-semibold text-indigo-600">{message}</p>}</div>}
      {!isLoading && classes.length === 0 && <p className="text-slate-500 text-center">Belum ada data kelas.</p>}
      {!isLoading && students.length === 0 && selectedClass && <p className="text-slate-500 text-center">Tidak ada siswa di kelas ini.</p>}
    </Card>
  );
}

// --- Komponen Laporan ---
function ReportsPage({ userId }) {
  const [view, setView] = useState('class');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [allAttendance, setAllAttendance] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [reportEndDate, setReportEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const [year, setYear] = useState(new Date().getFullYear());
  const privateCollection = (name) => collection(db, 'artifacts', appId, 'users', userId, name);
  useEffect(() => { const q = query(privateCollection('classes')); const unsubscribe = onSnapshot(q, (snapshot) => { const d = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); setClasses(d); if (d.length > 0 && !selectedClass) setSelectedClass(d[0].id); }); return () => unsubscribe(); }, [userId]);
  useEffect(() => { if (!selectedClass) { setStudents([]); setAllAttendance([]); return; } setIsLoading(true); const sQ = query(privateCollection('students'), where('classId', '==', selectedClass)); const aQ = query(privateCollection('attendance'), where('classId', '==', selectedClass)); const unsubS = onSnapshot(sQ, (s) => { const sL = s.docs.map(d => ({ id: d.id, ...d.data() })); setStudents(sL); if (sL.length > 0 && !selectedStudent) setSelectedStudent(sL[0].id); }); const unsubA = onSnapshot(aQ, (s) => { setAllAttendance(s.docs.map(d => ({id: d.id, ...d.data()}))); setIsLoading(false); }); return () => { unsubS(); unsubA(); }; }, [selectedClass, userId]);
  
  const classReportData = useMemo(() => {
    const counts = { 'Hadir': 0, 'Sakit': 0, 'Izin': 0, 'Alpa': 0 };
    allAttendance.forEach(att => {
        const attDate = att.date.toDate();
        if (attDate >= reportStartDate && attDate <= reportEndDate) { if (counts.hasOwnProperty(att.status)) counts[att.status]++; }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  }, [allAttendance, reportStartDate, reportEndDate]);

  const handleMonthChange = (month, year) => { setReportStartDate(new Date(year, month, 1)); setReportEndDate(new Date(year, month + 1, 0)); setYear(year); };
  const setSemester = (semester) => { const currentYear = year; if (semester === 1) { setReportStartDate(new Date(currentYear, 0, 1)); setReportEndDate(new Date(currentYear, 5, 30)); } else { setReportStartDate(new Date(currentYear, 6, 1)); setReportEndDate(new Date(currentYear, 11, 31)); } };
  
  const studentReportData = useMemo(() => {
    if (!selectedStudent) return { summary: [], details: [] };
    const counts = { 'Hadir': 0, 'Sakit': 0, 'Izin': 0, 'Alpa': 0 };
    const details = allAttendance.filter(att => att.studentId === selectedStudent).sort((a, b) => b.date.toDate() - a.date.toDate());
    details.forEach(att => { if (counts.hasOwnProperty(att.status)) counts[att.status]++; });
    return { summary: Object.entries(counts).map(([name, value]) => ({ name, value })), details };
  }, [allAttendance, selectedStudent]);

  const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444'];
  const STATUS_COLORS = { Hadir: 'bg-green-500', Sakit: 'bg-yellow-500', Izin: 'bg-blue-500', Alpa: 'bg-red-500' };
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i);

  return (
    <Card>
      <div className="flex border-b mb-4"><button onClick={() => setView('class')} className={`py-2 px-4 font-semibold flex items-center gap-2 ${view === 'class' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'}`}><FileText size={16}/> Laporan Kelas</button><button onClick={() => setView('student')} className={`py-2 px-4 font-semibold flex items-center gap-2 ${view === 'student' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'}`}><UserCheck size={16}/> Laporan Siswa</button></div>
      {view === 'class' && (
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Laporan Absensi Kelas</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6">
            <div className="md:col-span-1"><label className="block text-sm font-medium text-slate-600 mb-1">Kelas</label><Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
            <div className="md:col-span-1"><label className="block text-sm font-medium text-slate-600 mb-1">Bulan</label><Select value={reportStartDate.getMonth()} onChange={e => handleMonthChange(parseInt(e.target.value), year)}>{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</Select></div>
            <div className="md:col-span-1"><label className="block text-sm font-medium text-slate-600 mb-1">Tahun</label><Select value={year} onChange={e => handleMonthChange(reportStartDate.getMonth(), parseInt(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</Select></div>
            <div className="md:col-span-1 flex gap-2"><Button onClick={() => setSemester(1)} variant="secondary" className="w-full text-xs">Semester 1</Button><Button onClick={() => setSemester(2)} variant="secondary" className="w-full text-xs">Semester 2</Button></div>
          </div>
          <div style={{ width: '100%', height: 400 }}>{isLoading ? <p className="text-center">Memuat...</p> : classReportData.length > 0 ? (<ResponsiveContainer><PieChart><Pie data={classReportData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={120} fill="#8884d8" dataKey="value">{classReportData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [`${value} kali`, 'Jumlah']}/><Legend /></PieChart></ResponsiveContainer>) : <div className="flex items-center justify-center h-full"><p className="text-slate-500">Tidak ada data.</p></div>}</div>
        </div>
      )}
      {view === 'student' && (
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Laporan Absensi Individual Siswa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end mb-6">
             <div><label className="block text-sm font-medium text-slate-600 mb-1">Kelas</label><Select value={selectedClass} onChange={e => {setSelectedClass(e.target.value); setSelectedStudent('');}}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
             <div><label className="block text-sm font-medium text-slate-600 mb-1">Siswa</label><Select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} disabled={students.length === 0}>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          </div>
          {isLoading ? <p className="text-center">Memuat...</p> : selectedStudent && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div className="lg:col-span-1"><h3 className="font-bold text-lg mb-2">Ringkasan Total</h3><div style={{ width: '100%', height: 250 }}><ResponsiveContainer><BarChart data={studentReportData.summary} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}><XAxis type="number" /><YAxis type="category" dataKey="name" width={60} /><Tooltip /><Bar dataKey="value" fill="#8884d8">{studentReportData.summary.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div></div>
                <div className="lg:col-span-2"><h3 className="font-bold text-lg mb-2">Detail Kehadiran</h3><div className="space-y-2 max-h-80 overflow-y-auto">{studentReportData.details.length > 0 ? studentReportData.details.map(att => (<div key={att.id} className="bg-slate-50 p-3 rounded-lg"><div className="flex justify-between items-center"><span className="font-semibold">{att.date.toDate().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span><span className={`px-2 py-0.5 text-xs text-white rounded-full ${STATUS_COLORS[att.status]}`}>{att.status}</span></div>{att.note && <p className="text-sm text-slate-600 mt-1 pl-1 border-l-2 border-slate-300">Catatan: {att.note}</p>}</div>)) : <p className="text-slate-500">Tidak ada catatan.</p>}</div></div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
