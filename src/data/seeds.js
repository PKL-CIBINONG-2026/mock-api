/**
 * seeds.js — Data awal untuk 4 studi kasus.
 * Tombol "Reset All Databases" akan mengembalikan IndexedDB ke data ini.
 */

export const seeds = {
  articles: [
    {
      id: 'art-101',
      title: 'Memahami Event Loop di JavaScript',
      slug: 'memahami-event-loop-di-javascript',
      content:
        'Event loop adalah mekanisme yang membuat JavaScript bisa menjalankan kode asynchronous walaupun single-threaded. Artikel ini membahas call stack, task queue, dan microtask queue dengan contoh sederhana.',
      category: 'Programming',
      tags: ['javascript', 'async'],
      status: 'published',
      isPinned: true,
      views: 142,
      updatedAt: '2026-11-20T08:00:00.000Z',
    },
    {
      id: 'art-102',
      title: 'Panduan Fetch API untuk Pemula',
      slug: 'panduan-fetch-api-untuk-pemula',
      content:
        'Fetch API adalah cara modern untuk melakukan HTTP request di browser. Kita akan belajar GET, POST, PUT, PATCH, dan DELETE serta cara membaca status code dengan benar.',
      category: 'Programming',
      tags: ['javascript', 'fetch', 'http'],
      status: 'published',
      isPinned: false,
      views: 98,
      updatedAt: '2026-11-18T03:15:00.000Z',
    },
    {
      id: 'art-103',
      title: 'Tips Menyusun Layout dengan CSS Grid',
      slug: 'tips-menyusun-layout-dengan-css-grid',
      content:
        'CSS Grid memudahkan kita membuat layout dua dimensi. Dengan grid-template-areas, struktur halaman jadi lebih mudah dibaca dan dirawat.',
      category: 'Design',
      tags: ['css', 'layout'],
      status: 'published',
      isPinned: false,
      views: 76,
      updatedAt: '2026-11-15T10:30:00.000Z',
    },
    {
      id: 'art-104',
      title: 'Cara Menulis Commit Message yang Baik',
      slug: 'cara-menulis-commit-message-yang-baik',
      content:
        'Commit message yang jelas membantu tim memahami riwayat perubahan. Gunakan kalimat perintah singkat dan jelaskan alasan perubahan di bagian body.',
      category: 'Workflow',
      tags: ['git', 'teamwork'],
      status: 'draft',
      isPinned: false,
      views: 0,
      updatedAt: '2026-11-21T07:45:00.000Z',
    },
    {
      id: 'art-105',
      title: 'Mengenal REST API dan HTTP Status Code',
      slug: 'mengenal-rest-api-dan-http-status-code',
      content:
        'REST API memakai HTTP method sebagai kata kerja dan URL sebagai kata benda. Status code seperti 200, 201, 204, 400, 404, dan 409 memberi tahu klien hasil dari request.',
      category: 'Programming',
      tags: ['http', 'api'],
      status: 'published',
      isPinned: true,
      views: 210,
      updatedAt: '2026-11-10T02:00:00.000Z',
    },
    {
      id: 'art-106',
      title: 'Aksesibilitas Web: Mulai dari Hal Kecil',
      slug: 'aksesibilitas-web-mulai-dari-hal-kecil',
      content:
        'Aksesibilitas membuat website bisa dipakai semua orang. Mulailah dengan atribut alt pada gambar, label pada form, dan kontras warna yang cukup.',
      category: 'Design',
      tags: ['a11y', 'html'],
      status: 'draft',
      isPinned: false,
      views: 0,
      updatedAt: '2026-11-22T09:20:00.000Z',
    },
  ],

  bookings: [
    { id: 'bkg-201', roomId: 'ROOM-A', bookedBy: 'Dina Kartika', date: '2026-11-25', startTime: '09:00', endTime: '11:00', participants: 6, status: 'confirmed', notes: 'Butuh kabel HDMI tambahan' },
    { id: 'bkg-202', roomId: 'ROOM-A', bookedBy: 'Bagas Saputra', date: '2026-11-25', startTime: '13:00', endTime: '14:30', participants: 4, status: 'confirmed', notes: null },
    { id: 'bkg-203', roomId: 'ROOM-B', bookedBy: 'Sinta Maharani', date: '2026-11-25', startTime: '10:00', endTime: '12:00', participants: 10, status: 'checked_in', notes: 'Rapat evaluasi bulanan' },
    { id: 'bkg-204', roomId: 'ROOM-C', bookedBy: 'Fajar Nugroho', date: '2026-11-26', startTime: '08:30', endTime: '09:30', participants: 3, status: 'confirmed', notes: 'Daily standup tim mobile' },
    { id: 'bkg-205', roomId: 'ROOM-B', bookedBy: 'Putri Ayuningtyas', date: '2026-11-26', startTime: '15:00', endTime: '16:00', participants: 8, status: 'cancelled', notes: 'Dibatalkan, klien reschedule' },
    { id: 'bkg-206', roomId: 'ROOM-A', bookedBy: 'Rizky Hidayat', date: '2026-11-27', startTime: '10:00', endTime: '12:00', participants: 5, status: 'confirmed', notes: 'Interview kandidat PKL' },
  ],

  users: [
    { id: 'usr-301', fullName: 'Raka Pratama', email: 'raka@example.com', phone: '081234567890', bio: 'Frontend Developer Intern', address: 'Tangerang Selatan', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Raka', preferences: { theme: 'dark', twoFactorEnabled: true, emailNotifications: true } },
    { id: 'usr-302', fullName: 'Nadia Putri', email: 'nadia@example.com', phone: '082198765432', bio: 'UI/UX Designer', address: 'Bogor', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nadia', preferences: { theme: 'light', twoFactorEnabled: false, emailNotifications: true } },
    { id: 'usr-303', fullName: 'Andi Wijaya', email: 'andi.wijaya@example.com', phone: '085711223344', bio: 'Backend Engineer', address: 'Depok', avatarUrl: null, preferences: { theme: 'system', twoFactorEnabled: true, emailNotifications: false } },
    { id: 'usr-304', fullName: 'Siti Rahmawati', email: 'siti.r@example.com', phone: '081355667788', bio: null, address: 'Cibinong', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Siti', preferences: { theme: 'light', twoFactorEnabled: false, emailNotifications: false } },
    { id: 'usr-305', fullName: 'Yoga Prasetyo', email: 'yoga@example.com', phone: '087812340000', bio: 'QA Tester', address: null, avatarUrl: null, preferences: { theme: 'dark', twoFactorEnabled: false, emailNotifications: true } },
    { id: 'usr-306', fullName: 'Maya Lestari', email: 'maya.lestari@example.com', phone: '089644332211', bio: 'Project Manager', address: 'Jakarta Selatan', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya', preferences: { theme: 'system', twoFactorEnabled: true, emailNotifications: true } },
  ],

  products: [
    { id: 'prd-401', sku: 'KB-MECH-01', name: 'Mechanical Keyboard TKL', category: 'Electronics', costPrice: 450000, sellPrice: 650000, stock: 4, minStock: 5, supplier: 'PT Nusantara Tech' },
    { id: 'prd-402', sku: 'MS-WL-02', name: 'Wireless Mouse Ergonomic', category: 'Electronics', costPrice: 120000, sellPrice: 185000, stock: 25, minStock: 10, supplier: 'PT Nusantara Tech' },
    { id: 'prd-403', sku: 'CH-OFF-01', name: 'Kursi Kantor Ergonomis', category: 'Furniture', costPrice: 950000, sellPrice: 1350000, stock: 7, minStock: 3, supplier: 'CV Mebel Jaya' },
    { id: 'prd-404', sku: 'PP-A4-80', name: 'Kertas HVS A4 80gsm (1 rim)', category: 'Stationery', costPrice: 42000, sellPrice: 55000, stock: 3, minStock: 20, supplier: 'Toko ATK Sentosa' },
    { id: 'prd-405', sku: 'MN-24-IPS', name: 'Monitor 24 inch IPS', category: 'Electronics', costPrice: 1500000, sellPrice: 1990000, stock: 12, minStock: 4, supplier: 'PT Layar Prima' },
    { id: 'prd-406', sku: 'DK-STD-01', name: 'Standing Desk Elektrik', category: 'Furniture', costPrice: 2800000, sellPrice: 3750000, stock: 2, minStock: 2, supplier: 'CV Mebel Jaya' },
  ],
};
